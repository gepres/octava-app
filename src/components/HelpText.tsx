/** Texto de ayuda obligatorio. No cambiar sin revisar el lenguaje de la app. */
export const HELP_TEXT =
  "Esta app acompaña una práctica simbólica de intención y registro personal. Los códigos del tablero son valores configurables. Los tonos son sonidos reproducidos por tu dispositivo.";

export function HelpSteps() {
  return (
    <>
      <p className="m-0 text-base leading-relaxed">{HELP_TEXT}</p>
      <ol className="m-0 flex list-decimal flex-col gap-2 pl-5 text-[15px] leading-snug text-ink-2">
        <li>Escribe tu intención: lo que quieres sostener en esta sesión.</li>
        <li>Elige un código: gira los diales, escríbelo, tómalo de «Mis códigos» o usa el que Octava propone desde tu intención. Si quieres, dale un significado, como «Enfoque».</li>
        <li>Ajusta la duración y, si quieres, añade un testigo o un tono.</li>
        <li>Inicia la sesión. Al terminar puedes dejar una nota.</li>
      </ol>
      <p className="m-0 text-[13px] text-ink-3">Todo se guarda solo en este dispositivo. Más detalles en Ajustes.</p>
    </>
  );
}
