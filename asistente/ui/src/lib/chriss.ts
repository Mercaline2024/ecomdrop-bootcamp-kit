// Chriss: la mascota de Ecomdrop guía el onboarding.
// Voz: colega cercano, hombre, frases cortas, nunca técnico de más. Poses en public/chriss/.

export type Pose = 'hola' | 'esperando' | 'escribiendo' | 'pulgar' | 'listo' | 'celebrando'

export type Etapa = 'equipo' | 'herramientas' | 'claves' | 'conectores' | 'tienda' | 'final'

export interface Mensaje { pose: Pose; texto: string }

export const BIENVENIDA: Record<Etapa, Mensaje> = {
  equipo: {
    pose: 'hola',
    texto: '¡Hola! Soy Chriss, de Ecomdrop. Te acompaño a dejar tu equipo listo para el bootcamp. Son seis pasos y yo te voy diciendo qué hacer en cada uno. Primero, mira lo que encontré en tu computador.',
  },
  herramientas: {
    pose: 'esperando',
    texto: 'Ahora instalo las herramientas con las que vas a trabajar. Pulsa «Instalar todo» y tómate un café: lo más largo es el modelo de transcripción (1,6 GB). Si algo falla, te lo explico.',
  },
  claves: {
    pose: 'escribiendo',
    texto: 'Tus claves se quedan solo en este computador, con permisos únicamente para tu usuario. La de kie.ai es la única obligatoria: con ella generas imágenes, voz, música y video. Pulsa «Probar» para confirmar que funciona.',
  },
  conectores: {
    pose: 'escribiendo',
    texto: 'Los conectores unen a Claude con tu tienda. Shopify y Meta Ads se agregan en claude.ai con el nombre exacto de la tabla. El MCP oficial de Dropi ya lo registré: solo entra con tu cuenta de Dropi. Los de Ecomdrop son solo si usas esa plataforma.',
  },
  tienda: {
    pose: 'listo',
    texto: 'Vamos a crear tu primera tienda. Con estos datos preparo la carpeta, tus claves y la configuración. Lo demás lo completo yo desde los conectores cuando abras Claude.',
  },
  final: {
    pose: 'celebrando',
    texto: '¡Lo lograste! Hago una última revisión. Si todo sale en verde, abre una terminal en la carpeta de tu tienda, escribe «claude» y dime «da de alta esta tienda».',
  },
}

export const EVENTOS = {
  pasoOk: (titulo: string): Mensaje => ({ pose: 'pulgar', texto: `${titulo}: listo. Sigo con lo que falta.` }),
  pasoError: (titulo: string): Mensaje => ({
    pose: 'escribiendo',
    texto: `Algo falló en «${titulo}». Mira la línea en rojo del registro. Si no sabes qué hacer, pregúntame aquí abajo o pulsa «Reintentar».`,
  }),
  todoOk: (): Mensaje => ({ pose: 'celebrando', texto: '¡Todas las herramientas quedaron instaladas! Sigamos con tus claves.' }),
  codigoGithub: (codigo: string): Mensaje => ({
    pose: 'escribiendo',
    texto: `Te mostré un código: ${codigo}. Cópialo, pulsa «Abrir GitHub» y pégalo. Así confirmo que estás inscrito en el bootcamp.`,
  }),
  claveOk: (): Mensaje => ({ pose: 'pulgar', texto: 'La clave funciona. Guárdala y seguimos.' }),
  claveError: (): Mensaje => ({ pose: 'escribiendo', texto: 'Esa clave no funcionó. Cópiala otra vez desde el panel del servicio, sin espacios al inicio ni al final.' }),
  conectoresOk: (): Mensaje => ({ pose: 'pulgar', texto: 'Shopify y Meta Ads están conectados: ya tienes lo indispensable.' }),
  tiendaOk: (): Mensaje => ({ pose: 'celebrando', texto: '¡Tu tienda quedó creada! Ya casi terminamos.' }),
  pensando: (): Mensaje => ({ pose: 'esperando', texto: 'Déjame pensarlo…' }),
}

export const PREGUNTAS_RAPIDAS: Record<Etapa, string[]> = {
  equipo: ['¿Qué se va a instalar?', '¿Cuánto espacio necesito?'],
  herramientas: ['¿Por qué necesito Python?', 'Un paso falló, ¿qué hago?'],
  claves: ['¿Dónde consigo la clave de kie.ai?', '¿Es seguro guardarla aquí?'],
  conectores: ['¿Cómo conecto Dropi?', '¿Necesito los de Ecomdrop?'],
  tienda: ['¿Qué pasa si no tengo dominio?', '¿Puedo crear otra tienda después?'],
  final: ['¿Cómo empiezo a trabajar?', '¿Cómo pido ayuda a soporte?'],
}
