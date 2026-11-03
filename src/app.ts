export function greet(name: string, locale: string = 'en'): string {
  const greetings: Record<string, string> = {
    en: 'Hello',
    es: 'Hola',
    fr: 'Bonjour',
  };
  const word = greetings[locale] ?? greetings.en;
  return `${word}, ${name}!`;
}
