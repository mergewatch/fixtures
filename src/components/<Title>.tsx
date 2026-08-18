// Filename contains angle brackets to stress Mermaid node-ID sanitization.
// Historically: <Title>.tsx bled raw `<` into Mermaid labels.

export type TitleProps = {
  children: string;
  level?: 1 | 2 | 3;
};

export function Title({ children, level = 1 }: TitleProps): string {
  return `<h${level}>${children}</h${level}>`;
}
