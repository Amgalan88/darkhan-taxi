export function tugrik(n: number): string {
  return `₮${Math.round(n).toLocaleString('en-US')}`;
}

export function normalizePhone(input: string): string {
  let p = input.replace(/\D/g, '');
  if (p.length === 11 && p.startsWith('976')) p = p.slice(3);
  return p;
}
