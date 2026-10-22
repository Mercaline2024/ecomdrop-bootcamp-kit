# Proyecto de ejemplo

Node + Python, sin nada del SIE. Lo usa el workflow de pruebas del kit para comprobar que `ecomdrop-doctor`
detecta lo que falta, lo instala con `--fix` y que el proyecto arranca.

```bash
ecomdrop-doctor            # diagnostica: faltan dependencias de Node y Python y el .env
ecomdrop-doctor --fix      # npm ci, uv venv + openpyxl, crea .env desde .env.example
npm start                  # http://127.0.0.1:3000/salud → {"ok":true}
```

En Claude Code: `/setup-proyecto`.
