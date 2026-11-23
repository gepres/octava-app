import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { codeFigurePoints } from "@/domain/code";
import {
  IconBookmark,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconDatabase,
  IconHelp,
  IconHistory,
  IconImage,
  IconShare,
  IconVolume,
} from "@/components/Icons";
import { InstallButton, StandaloneRedirect } from "./LandingClient";

const ANCHORS = [
  { href: "#para-que", label: "Para qué sirve" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#beneficios", label: "Beneficios" },
  { href: "#preguntas", label: "Preguntas" },
] as const;

const PRACTICES = [
  { name: "Concentración", moment: "Antes de estudiar o trabajar", code: "30521470", chips: ["20 min", "440 Hz"] },
  { name: "Pausa consciente", moment: "Entre reuniones o tareas", code: "20406080", chips: ["5 min", "Sin sonido"] },
  { name: "Cierre del día", moment: "Para soltar la jornada", code: "90817263", chips: ["10 min", "220 Hz"] },
] as const;

const BENEFITS: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <IconClock size={20} />,
    title: "El tiempo sigue aunque cierres la app",
    text: "La sesión se guarda con su hora de fin. Si bloqueas el móvil o cierras la pestaña, al volver ves el tiempo real y se cierra sola a su hora.",
  },
  {
    icon: <IconBookmark size={20} />,
    title: "Tus prácticas, a un toque",
    text: "Guarda código, duración y tono como un preset y cárgalo en el Tablero cuando lo necesites. Trae tres de ejemplo para empezar.",
  },
  {
    icon: <IconHistory size={20} />,
    title: "Memoria de cada sesión",
    text: "El historial guarda el código, la intención, el tiempo y tu nota sobre cómo fue. Fíltralo y reutiliza cualquier configuración.",
  },
  {
    icon: <IconImage size={20} />,
    title: "Un testigo por sesión",
    text: "Añade un nombre o una imagen como referencia. La imagen se reduce y se guarda solo en tu dispositivo.",
  },
  {
    icon: <IconVolume size={20} />,
    title: "Sonido, solo si lo quieres",
    text: "Un tono suave de 220, 432 o 440 Hz que se detiene al pausar, al terminar o al salir. Parte apagado.",
  },
  {
    icon: <IconHelp size={20} />,
    title: "Fácil desde el primer día",
    text: "Una guía paso a paso te enseña cada control. Se usa con teclado y lector de pantalla, y respeta el movimiento reducido.",
  },
];

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "¿Necesito crear una cuenta?",
    a: "No. Abres Octava y empiezas. No hay registro, contraseña ni correo.",
  },
  {
    q: "¿Dónde se guardan mis datos?",
    a: "En el navegador de tu dispositivo. Presets, sesiones, notas e imágenes no se envían a ningún servidor. Si borras los datos del sitio o cambias de navegador, no se trasladan.",
  },
  {
    q: "¿Funciona sin internet?",
    a: "Sí. Después de la primera visita, Octava queda guardada en tu dispositivo y se abre sin conexión, también instalada como app.",
  },
  {
    q: "¿Qué es el código de ocho dígitos?",
    a: "Es la combinación de los ocho diales, cada uno del 0 al 9. Puedes componerla con la perilla, con el teclado o pegarla. Los códigos de los ejemplos son ilustrativos.",
  },
  {
    q: "¿Qué es el testigo?",
    a: "Una referencia opcional de la sesión: un nombre, una imagen o ambos. Queda en la ficha de la sesión y en el historial.",
  },
  {
    q: "¿Octava sustituye un tratamiento?",
    a: "No. Octava es una herramienta de práctica simbólica y registro personal. No ofrece diagnósticos ni sustituye la atención médica o psicológica.",
  },
];

export function Landing() {
  return (
    <div className="landing overflow-x-clip">
      <StandaloneRedirect />
      <a href="#contenido" className="sr-only-focusable fixed left-3 top-3 z-50 rounded-xl bg-carbon px-4 py-3 text-ink">
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-40 px-3 pt-3 lg:px-6">
        <div className="float mx-auto flex h-16 max-w-[1200px] items-center gap-2 rounded-[22px] pl-4 pr-2">
          <Link href="/" className="flex shrink-0 items-center" aria-label="Octava, inicio">
            <Image src="/brand/octava-logo.png" alt="Octava" width={122} height={32} loading="eager" />
          </Link>
          <nav aria-label="Secciones de la página" className="ml-auto hidden items-center gap-0.5 lg:flex">
            {ANCHORS.map((a) => (
              <a key={a.href} href={a.href} className="rounded-full px-3.5 py-2.5 text-[15px] font-medium text-ink-2 no-underline transition-colors hover:bg-white/5 hover:text-ink">
                {a.label}
              </a>
            ))}
          </nav>
          <Link href="/tablero" className="btn-go ml-auto !min-h-11 !px-5 !text-[15px] lg:ml-3">
            Abrir Octava
          </Link>
        </div>
      </header>

      <main id="contenido" tabIndex={-1} className="outline-none">
        <Hero />
        <Facts />
        <Practices />
        <HowItWorks />
        <Benefits />
        <Privacy />
        <Install />
        <Questions />
        <FinalCta />
      </main>

      <Footer />
    </div>
  );
}

/* ——— Portada ——— */

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative mx-auto grid max-w-[1200px] items-center gap-14 px-5 pb-20 pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] lg:gap-12 lg:px-8 lg:pb-28 lg:pt-20">
      <div className="relative z-10 flex flex-col items-start gap-6">
        <p className="rise m-0 inline-flex h-8 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 text-[13px] font-medium text-ink-2">
          <span className="h-[7px] w-[7px] rounded-full bg-turq shadow-[0_0_10px_#6BE4D7]" aria-hidden="true" />
          Práctica simbólica · funciona sin conexión
        </p>
        <h1 id="hero-title" className="rise rise-2 m-0 text-[clamp(42px,6.4vw,74px)] font-semibold leading-[1.02] tracking-[-0.045em]">
          Ocho diales para <span className="text-copper-grad">sostener tu intención</span>.
        </h1>
        <p className="rise rise-3 m-0 max-w-[520px] text-lg leading-relaxed text-ink-2 lg:text-xl">
          Octava convierte tu práctica en un ritual claro: compones un código, fijas la intención y el tiempo, y cada sesión queda registrada. Sin cuenta y con todo guardado en tu dispositivo.
        </p>
        <div className="rise rise-4 flex flex-wrap gap-3">
          <Link href="/tablero" className="btn-go !min-h-14 !px-7 !text-[17px]">
            Abrir Octava
            <IconChevronRight size={18} />
          </Link>
          <a href="#como-funciona" className="btn-glass !min-h-14 !px-6">
            Ver cómo funciona
          </a>
        </div>
        <ul className="rise rise-5 m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-[15px] text-ink-2">
          {["Sin cuenta", "Sin conexión", "Datos en tu dispositivo"].map((t) => (
            <li key={t} className="inline-flex items-center gap-2">
              <IconCheck size={18} className="text-turq" />
              {t}
            </li>
          ))}
        </ul>
      </div>
      <HeroVisual />
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="rise rise-3 relative mx-auto w-full max-w-[520px] sm:max-w-[640px] lg:max-w-none">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-[14%]"
        style={{
          background:
            "radial-gradient(48% 46% at 62% 42%, rgba(60,207,192,0.2), rgba(60,207,192,0) 72%), radial-gradient(30% 30% at 28% 70%, rgba(192,132,87,0.22), rgba(192,132,87,0) 72%)",
        }}
      />

      {/* Ordenador: el Tablero completo. */}
      <figure className="device-browser relative m-0 hidden sm:block">
        <div className="flex h-9 items-center gap-1.5 border-b border-white/[0.06] px-4" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        </div>
        <Image
          src="/landing/tablero-escritorio.webp"
          alt="El Tablero de Octava en el ordenador: ocho diales con el código 30521470, la perilla de cobre y la intención, la duración y el sonido de la sesión."
          width={2000}
          height={1250}
          loading="eager"
          fetchPriority="high"
          className="block h-auto w-full"
        />
      </figure>

      {/* Móvil: el Tablero y la sesión en curso; en pantallas anchas, la sesión sobre el ordenador. */}
      <div className="relative flex items-start justify-center sm:absolute sm:-bottom-14 sm:-left-8 sm:block sm:w-[30%]">
        <figure className="device-phone relative z-10 m-0 w-[56%] sm:hidden">
          <Image src="/landing/tablero-movil.webp" alt="El Tablero en el móvil, con la perilla y el botón Iniciar sesión." width={780} height={1688} loading="eager" className="block h-auto w-full" />
        </figure>
        <figure className="device-phone drift relative m-0 -ml-[12%] mt-[14%] w-[50%] rotate-[5deg] sm:m-0 sm:w-full sm:rotate-0">
          <Image src="/landing/sesion-movil.webp" alt="Una sesión en curso en el móvil: quedan 13:48 de 20 minutos." width={780} height={1688} loading="eager" className="block h-auto w-full" />
        </figure>
      </div>

      <div aria-hidden="true" className="glass absolute -top-5 right-5 hidden items-center gap-2.5 rounded-full !bg-[#15171a]/90 py-2.5 pl-3.5 pr-4 text-sm font-medium sm:flex">
        <span className="h-[7px] w-[7px] rounded-full bg-turq shadow-[0_0_10px_#6BE4D7]" />
        Sesión en curso · <span className="tabular-nums text-turq">13:48</span>
      </div>
      <div aria-hidden="true" className="glass absolute -bottom-7 right-6 hidden items-center gap-2.5 rounded-full !bg-[#15171a]/90 py-2.5 pl-3.5 pr-4 text-sm font-medium sm:flex">
        <IconDatabase size={17} className="text-copper-light" />
        Guardado solo en este dispositivo
      </div>
    </div>
  );
}

function Facts() {
  const facts = [
    { n: "8", label: "diales, del 0 al 9" },
    { n: "1–60", label: "minutos por sesión" },
    { n: "3", label: "tonos: 220, 432 y 440 Hz" },
    { n: "0", label: "cuentas que crear" },
  ];
  return (
    <section aria-label="Octava en cifras" className="mx-auto max-w-[1200px] px-5 lg:px-8">
      <dl className="glass m-0 grid grid-cols-2 overflow-hidden rounded-[26px] lg:grid-cols-4">
        {facts.map((f, i) => (
          <div
            key={f.label}
            className={[
              "flex flex-col gap-1 px-5 py-6 lg:px-7 lg:py-8",
              i % 2 === 1 ? "border-l border-white/[0.06]" : "",
              i >= 2 ? "border-t border-white/[0.06] lg:border-t-0" : "",
              i === 2 ? "lg:border-l" : "",
            ].join(" ")}
          >
            <dt className="order-2 text-sm leading-snug text-ink-3">{f.label}</dt>
            <dd className="text-ivory-grad order-1 m-0 text-[44px] font-extralight leading-none tracking-[-0.04em] lg:text-[60px]">{f.n}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ——— Para qué sirve ——— */

function Practices() {
  return (
    <Section id="para-que" eyebrow="Para qué sirve" title="Un ritual breve para los momentos que quieres cuidar." lead="Octava te ayuda a detenerte, poner en palabras lo que quieres sostener y darle un tiempo. Trae tres prácticas de ejemplo:">
      <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
        {PRACTICES.map((p) => (
          <li key={p.name} className="glass relative flex flex-col gap-5 overflow-hidden rounded-[26px] p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[13px] font-medium text-copper-light">{p.moment}</span>
                <h3 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">{p.name}</h3>
              </div>
              <CodeFigure code={p.code} />
            </div>
            <p className="m-0 text-[28px] font-light leading-none tracking-[0.16em]" aria-label={`Código ${p.code}`}>
              {p.code.slice(0, 4)}
              <span className="inline-block w-3" />
              {p.code.slice(4)}
            </p>
            <div className="flex flex-wrap gap-2">
              {p.chips.map((c) => (
                <span key={c} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[13px] font-medium text-ink-2">
                  {c}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <p className="m-0 mt-4 text-sm text-ink-3">Son presets de ejemplo con códigos ilustrativos: edítalos o crea los tuyos.</p>
    </Section>
  );
}

/** La figura de la sesión: cada radio mide el valor de su dial. */
function CodeFigure({ code }: { code: string }) {
  const points = codeFigurePoints(code, 40, 40, 7, 2.9);
  return (
    <svg viewBox="0 0 80 80" width={72} height={72} aria-hidden="true" className="shrink-0">
      <circle cx="40" cy="40" r="37" fill="rgba(0,0,0,0.25)" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
      <polygon points={points} fill="#3CCFC0" fillOpacity="0.18" stroke="#8CF0E5" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/* ——— Cómo funciona ——— */

function HowItWorks() {
  return (
    <Section id="como-funciona" eyebrow="Cómo funciona" title="Tres pasos, sin curva de aprendizaje." lead="Todo cabe en una pantalla: el Tablero. Y si dudas, la guía paso a paso te lo enseña dentro de la app.">
      <ol className="m-0 grid list-none gap-4 p-0 lg:grid-cols-3">
        <Step n={1} title="Compón tu código" text="Gira los ocho diales con la perilla, las flechas del teclado o pegando un código de ocho cifras.">
          <div className="flex items-center justify-center gap-1.5">
            {"30521470".split("").map((d, i) => (
              <span
                key={i}
                className={[
                  "flex h-[52px] w-[30px] items-center justify-center rounded-[10px] border text-xl",
                  i === 0 ? "border-turq/60 bg-turq-deep/15 shadow-[0_0_22px_-6px_rgba(60,207,192,0.7)]" : "border-white/[0.09] bg-white/[0.045]",
                  i === 4 ? "ml-2" : "",
                ].join(" ")}
              >
                {d}
              </span>
            ))}
          </div>
        </Step>
        <Step n={2} title="Prepara la sesión" text="Escribe tu intención, elige de 1 a 60 minutos y, si quieres, añade un testigo y un tono suave.">
          <div className="flex w-full max-w-[280px] flex-col gap-2.5">
            <div className="flex items-center justify-between rounded-2xl bg-white/[0.045] px-3.5 py-2.5 text-sm">
              <span className="text-ink-3">Intención</span>
              <span>Empezar el día con foco</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white/[0.045] px-3.5 py-2.5 text-sm">
              <span className="text-ink-3">Duración</span>
              <span>20 min</span>
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1 text-center text-[13px] font-medium text-ink-2">
              <span className="rounded-xl py-1.5">220 Hz</span>
              <span className="rounded-xl py-1.5">432 Hz</span>
              <span className="rounded-xl bg-turq-deep/20 py-1.5 text-turq shadow-[inset_0_0_0_1px_rgba(107,228,215,0.4)]">440 Hz</span>
            </div>
          </div>
        </Step>
        <Step n={3} title="Inicia y registra" text="El temporizador corre aunque cierres la app. Al terminar, escribe una nota: queda en tu historial.">
          <div className="relative flex h-[132px] w-[132px] items-center justify-center">
            <svg viewBox="0 0 132 132" className="absolute inset-0" aria-hidden="true">
              <defs>
                <linearGradient id="step-ring" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#ECBF92" />
                  <stop offset="1" stopColor="#8A5634" />
                </linearGradient>
              </defs>
              <circle cx="66" cy="66" r="60" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
              <circle cx="66" cy="66" r="60" fill="none" stroke="url(#step-ring)" strokeWidth="4" strokeLinecap="round" strokeDasharray="377" strokeDashoffset="117" transform="rotate(-90 66 66)" />
            </svg>
            <span className="flex flex-col items-center">
              <span className="text-[32px] font-extralight leading-none tracking-[-0.04em]">13:48</span>
              <span className="mt-1 text-xs text-ink-3">de 20:00</span>
            </span>
          </div>
        </Step>
      </ol>
    </Section>
  );
}

function Step({ n, title, text, children }: { n: number; title: string; text: string; children: ReactNode }) {
  return (
    <li className="glass flex flex-col overflow-hidden rounded-[26px]">
      <div aria-hidden="true" className="flex h-[188px] items-center justify-center border-b border-white/[0.06] bg-[radial-gradient(80%_90%_at_50%_0%,rgba(60,207,192,0.08),transparent_70%)] px-5">
        {children}
      </div>
      <div className="flex flex-col gap-2 p-6">
        <span className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full border border-copper-light/40 bg-copper/[0.14] text-sm font-semibold text-copper-light">
          {n}
        </span>
        <h3 className="m-0 text-xl font-semibold tracking-[-0.02em]">{title}</h3>
        <p className="m-0 text-[15px] leading-relaxed text-ink-2">{text}</p>
      </div>
    </li>
  );
}

/* ——— Beneficios ——— */

function Benefits() {
  return (
    <Section id="beneficios" eyebrow="Beneficios" title="Hecha para acompañarte, no para distraerte.">
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.42fr)]">
        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
          {BENEFITS.map((b) => (
            <li key={b.title} className="glass flex flex-col gap-3 rounded-[24px] p-6">
              <span className="ico !h-10 !w-10">{b.icon}</span>
              <h3 className="m-0 text-[17px] font-semibold leading-snug tracking-[-0.01em]">{b.title}</h3>
              <p className="m-0 text-[15px] leading-relaxed text-ink-2">{b.text}</p>
            </li>
          ))}
        </ul>
        <figure className="relative m-0 hidden lg:sticky lg:top-28 lg:block">
          <div aria-hidden="true" className="pointer-events-none absolute -inset-[18%]" style={{ background: "radial-gradient(50% 50% at 50% 45%, rgba(60,207,192,0.16), rgba(60,207,192,0) 72%)" }} />
          <div className="device-phone relative">
            <Image src="/landing/historial-movil.webp" alt="El Historial en el móvil: tres sesiones completadas con su intención, su hora y su código." width={780} height={1688} className="block h-auto w-full" />
          </div>
        </figure>
      </div>
    </Section>
  );
}

/* ——— Privacidad ——— */

function Privacy() {
  return (
    <section id="privacidad" aria-labelledby="privacidad-title" className="mx-auto max-w-[1200px] px-5 py-12 lg:px-8 lg:py-16">
      <div className="privacy-panel relative grid items-center gap-8 overflow-hidden rounded-[32px] p-7 sm:p-10 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-14 lg:p-14">
        <div className="relative mx-auto flex h-[148px] w-[148px] items-center justify-center lg:h-[200px] lg:w-[200px]">
          <div aria-hidden="true" className="absolute inset-[-30%]" style={{ background: "radial-gradient(circle, rgba(217,162,115,0.28), rgba(217,162,115,0) 65%)" }} />
          <Image src="/brand/octava-emblema.png" alt="" width={256} height={256} className="relative h-full w-full" />
        </div>
        <div className="relative flex flex-col gap-5">
          <p className="eyebrow m-0">Privacidad</p>
          <h2 id="privacidad-title" className="m-0 text-[clamp(30px,4.2vw,48px)] font-semibold leading-[1.08] tracking-[-0.035em]">
            Lo tuyo se queda contigo.
          </h2>
          <p className="m-0 max-w-[620px] text-[17px] leading-relaxed text-ink-2">
            Octava no tiene cuentas ni servidores de datos. Presets, sesiones, notas e imágenes viven solo en el navegador de tu dispositivo y no pasan por ningún servidor.
          </p>
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-3">
            {["Sin registro ni contraseña", "Sin copia en internet", "Funciona sin conexión"].map((t) => (
              <li key={t} className="flex items-center gap-2.5 rounded-2xl bg-white/[0.05] px-4 py-3 text-[15px] font-medium">
                <IconCheck size={18} className="shrink-0 text-turq" />
                {t}
              </li>
            ))}
          </ul>
          <p className="m-0 text-sm text-ink-3">Como todo queda en tu navegador, si borras los datos del sitio se pierden: tú decides.</p>
        </div>
      </div>
    </section>
  );
}

/* ——— Instalar ——— */

function Install() {
  const platforms = [
    {
      name: "iPhone y iPad",
      steps: [
        <>Abre Octava en <strong className="font-semibold">Safari</strong>.</>,
        <>Toca <strong className="font-semibold">Compartir</strong> <IconShare size={17} className="inline align-[-3px]" />.</>,
        <>Elige <strong className="font-semibold">Añadir a pantalla de inicio</strong>.</>,
      ],
    },
    {
      name: "Android",
      steps: [
        <>Abre Octava en <strong className="font-semibold">Chrome</strong>.</>,
        <>Abre el menú <strong className="font-semibold">⋮</strong> del navegador.</>,
        <>Elige <strong className="font-semibold">Instalar app</strong>.</>,
      ],
    },
    {
      name: "Ordenador",
      steps: [
        <>En <strong className="font-semibold">Chrome o Edge</strong>, pulsa el icono de instalar de la barra de direcciones.</>,
        <>En <strong className="font-semibold">Safari para Mac</strong>: Archivo → Añadir al Dock.</>,
        <>Ábrela desde su icono, en su propia ventana.</>,
      ],
    },
  ];
  return (
    <Section id="instalar" eyebrow="Instálala" title="Tenla a mano, como una app." lead="Octava se instala desde el navegador, sin pasar por una tienda. Se abre en su propia ventana, con su icono, y funciona sin conexión.">
      <InstallButton />
      <ul className="m-0 mt-6 grid list-none gap-4 p-0 md:grid-cols-3">
        {platforms.map((p) => (
          <li key={p.name} className="glass flex flex-col gap-4 rounded-[24px] p-6">
            <h3 className="m-0 text-lg font-semibold tracking-[-0.01em]">{p.name}</h3>
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              {p.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-3 text-[15px] leading-snug text-ink-2">
                  <span aria-hidden="true" className="mt-[-3px] inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border border-copper-light/40 bg-copper/[0.14] text-[13px] font-semibold text-copper-light">
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ——— Preguntas ——— */

function Questions() {
  return (
    <Section id="preguntas" eyebrow="Preguntas frecuentes" title="Lo que suele preguntarse.">
      <div className="flex max-w-[860px] flex-col gap-3">
        {FAQ.map((f) => (
          <details key={f.q} className="group glass rounded-[22px] [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 rounded-[22px] px-6 py-4 text-[17px] font-medium">
              {f.q}
              <IconChevronRight size={20} className="shrink-0 text-ink-3 transition-transform group-open:rotate-90" />
            </summary>
            <p className="m-0 px-6 pb-5 text-[15px] leading-relaxed text-ink-2">{f.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

/* ——— Cierre ——— */

function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="mx-auto max-w-[1200px] px-5 pb-20 pt-8 lg:px-8 lg:pb-28">
      <div className="relative flex flex-col items-center gap-6 overflow-hidden rounded-[32px] border border-white/[0.08] px-6 py-14 text-center lg:py-20">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(60% 80% at 50% 0%, rgba(60,207,192,0.16), rgba(60,207,192,0) 70%), radial-gradient(50% 60% at 50% 110%, rgba(192,132,87,0.18), rgba(192,132,87,0) 70%)" }} />
        <Image src="/brand/octava-emblema.png" alt="" width={88} height={88} className="relative" />
        <h2 id="cta-title" className="relative m-0 max-w-[720px] text-[clamp(32px,4.6vw,54px)] font-semibold leading-[1.05] tracking-[-0.04em]">
          Tu primera sesión empieza aquí.
        </h2>
        <p className="relative m-0 max-w-[520px] text-[17px] leading-relaxed text-ink-2">
          Elige una práctica de ejemplo o compón tu propio código. No hace falta registrarse.
        </p>
        <div className="relative flex flex-wrap justify-center gap-3">
          <Link href="/tablero" className="btn-go !min-h-14 !px-7 !text-[17px]">
            Abrir Octava
            <IconChevronRight size={18} />
          </Link>
          <Link href="/tablero?guia=1" className="btn-glass !min-h-14 !px-6">
            Empezar con la guía
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 py-10 lg:flex-row lg:items-start lg:justify-between lg:px-8">
        <div className="flex flex-col gap-3">
          <Image src="/brand/octava-logo.png" alt="Octava" width={114} height={30} />
          <p className="m-0 max-w-[460px] text-sm leading-relaxed text-ink-3">
            Octava es una herramienta de práctica simbólica y registro personal. No ofrece diagnósticos ni sustituye la atención médica o psicológica.
          </p>
        </div>
        <nav aria-label="Enlaces del pie" className="flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
          <Link href="/tablero" className="text-ink-2 no-underline hover:text-ink">Abrir la app</Link>
          <Link href="/tablero?guia=1" className="text-ink-2 no-underline hover:text-ink">Guía de uso</Link>
          <a href="#preguntas" className="text-ink-2 no-underline hover:text-ink">Preguntas</a>
          <a href="#privacidad" className="text-ink-2 no-underline hover:text-ink">Privacidad</a>
        </nav>
      </div>
    </footer>
  );
}

/* ——— Piezas comunes ——— */

function Section({ id, eyebrow, title, lead, children }: { id: string; eyebrow: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mx-auto max-w-[1200px] px-5 py-14 lg:px-8 lg:py-20">
      <div className="mb-9 flex max-w-[760px] flex-col gap-4 lg:mb-12">
        <p className="eyebrow m-0">{eyebrow}</p>
        <h2 id={`${id}-title`} className="m-0 text-[clamp(30px,4.2vw,48px)] font-semibold leading-[1.08] tracking-[-0.035em]">
          {title}
        </h2>
        {lead ? <p className="m-0 text-[17px] leading-relaxed text-ink-2 lg:text-lg">{lead}</p> : null}
      </div>
      {children}
    </section>
  );
}
