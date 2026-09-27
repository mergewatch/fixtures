// Minimal heading component for the static renderer — returns raw markup
// rather than a vDOM node so it can be used outside React.

export type TitleProps = {
  children: string;
  level?: 1 | 2 | 3;
};

export function Title({ children, level = 1 }: TitleProps): string {
  return `<h${level}>${children}</h${level}>`;
}
