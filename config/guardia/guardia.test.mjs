// node --test config/guardia/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { decidir } from './guardia.mjs';

const H = os.homedir();
const P = path.join(H, 'proyectos', 'tiendas', 'mi-tienda');
const bash = (command, cwd = P) => decidir({ tool_name: 'Bash', tool_input: { command }, cwd });
const herramienta = (tool_name, tool_input, cwd = P) => decidir({ tool_name, tool_input, cwd });
const d = (r) => r?.decision ?? 'normal';

process.env.CLAUDE_PROJECT_DIR = P;

test('borrados recursivos dentro del proyecto: flujo normal', () => {
  for (const c of ['rm -rf node_modules', 'rm -rf ./dist build', 'rm -r productos/x/render', `rm -rf "${P}/tmp"`, 'rm -rf .next/*',
    'cd productos && rm -rf viejo', 'find . -name "*.pyc" -delete', 'rm archivo.txt', 'rm -f a.log']) {
    assert.equal(d(bash(c)), 'normal', c);
  }
});

test('borrados recursivos fuera del proyecto: bloqueados', () => {
  for (const c of ['rm -rf /', 'rm -rf ~', 'rm -rf ~/', 'rm -rf ~/Documents', 'rm -rf $HOME/proyectos', 'rm -rf ..', 'rm -rf ../otra-tienda',
    'rm -rf /tmp/../etc', 'sudo rm -rf /usr/local', 'rm -fr ~/.claude', 'rm -Rf ' + path.join(H, 'proyectos'), 'cd .. && rm -rf mi-tienda',
    'rm -rf .', 'rm -rf *', 'ls && rm -rf ~/Desktop', 'find ~ -name x -delete', 'find .. -exec rm {} \\;', 'rm --recursive ~/Library',
    'Remove-Item -Recurse -Force ~/Documents', 'rm -rf $OTRA', 'rm -rf $(pwd)/..', 'env X=1 rm -rf /opt']) {
    assert.equal(d(bash(c)), 'deny', c);
  }
});

test('sin carpeta de proyecto (Claude abierto en ~): todo borrado recursivo se bloquea', () => {
  const prev = process.env.CLAUDE_PROJECT_DIR;
  process.env.CLAUDE_PROJECT_DIR = H;
  assert.equal(d(bash('rm -rf proyectos/x', H)), 'deny');
  process.env.CLAUDE_PROJECT_DIR = prev;
});

test('llaves, llaveros y credenciales: bloqueados', () => {
  for (const c of ['cat ~/.ssh/id_rsa', 'ls ~/.ssh', 'cp ~/.ssh/config /tmp/x', 'security find-generic-password -s github',
    'security dump-keychain', 'cat ~/.aws/credentials', 'cat ~/.config/gh/hosts.yml', 'cat ~/.claude.json', 'cat ~/.ecomdrop/.env',
    'tar czf x.tgz ~/Library/Keychains', 'secret-tool lookup service x', 'cmdkey /list', 'base64 id_ed25519']) {
    assert.equal(d(bash(c)), 'deny', c);
  }
  assert.equal(d(herramienta('Read', { file_path: `${H}/.ssh/id_ed25519` })), 'deny');
  assert.equal(d(herramienta('Edit', { file_path: '~/.ssh/authorized_keys' })), 'deny');
  assert.equal(d(herramienta('Grep', { pattern: 'BEGIN', path: `${H}/.ssh` })), 'deny');
  assert.equal(d(herramienta('Glob', { pattern: `${H}/.ssh/*` })), 'deny');
  assert.equal(d(herramienta('Read', { file_path: `${H}/Library/Keychains/login.keychain-db` })), 'deny');
});

test('.env: el del proyecto pide confirmación, el de otros proyectos se bloquea, .env.example es libre', () => {
  assert.equal(d(herramienta('Read', { file_path: `${P}/.env` })), 'ask');
  assert.equal(d(herramienta('Edit', { file_path: '.env' })), 'ask');
  assert.equal(d(herramienta('Read', { file_path: `${H}/proyectos/tiendas/otra/.env` })), 'deny');
  assert.equal(d(herramienta('Read', { file_path: `${H}/proyectos/tiendas/otra/.env.production` })), 'deny');
  assert.equal(d(bash('cat ../otra/.env')), 'deny');
  assert.equal(d(bash('cat .env')), 'ask');
  assert.equal(d(herramienta('Read', { file_path: `${P}/.env.example` })), 'normal');
  assert.equal(d(bash('cp .env.example .env.sample')), 'normal');
});

test('trabajo normal: no interviene', () => {
  for (const c of ['npm install', 'git status && git diff', 'python3 sie/scripts/kie_gen.py --spec x.json', 'curl https://api.kie.ai/x',
    'ls -la', 'node -e "console.log(1)"', 'gh pr list', 'docker compose up -d', 'echo "rm -rf ~" > nota.txt']) {
    assert.equal(d(bash(c)), 'normal', c);
  }
  assert.equal(d(herramienta('Read', { file_path: `${P}/tienda.json` })), 'normal');
  assert.equal(d(herramienta('Write', { file_path: `${P}/productos/x/README.md`, content: 'hola' })), 'normal');
});

test('ejecutado como hook: responde JSON con permissionDecision', () => {
  const guardia = path.join(path.dirname(fileURLToPath(import.meta.url)), 'guardia.mjs');
  const r = spawnSync(process.execPath, [guardia], {
    input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'rm -rf ~' }, cwd: P }),
    encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: P },
  });
  assert.equal(r.status, 0);
  const j = JSON.parse(r.stdout);
  assert.equal(j.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.equal(j.hookSpecificOutput.permissionDecision, 'deny');
  const vacio = spawnSync(process.execPath, [guardia], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls' }, cwd: P }), encoding: 'utf8' });
  assert.equal(vacio.stdout, '');
  const roto = spawnSync(process.execPath, [guardia], { input: 'no es json', encoding: 'utf8' });
  assert.equal(roto.status, 0, 'una entrada inválida nunca rompe la sesión');
});
