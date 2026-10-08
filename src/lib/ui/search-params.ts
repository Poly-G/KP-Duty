export type SearchValue = string | string[] | undefined;
// Next.js supplies arrays for repeated query parameters. Treat the first value as the selection.
export function firstSearchValue(value:SearchValue,maxLength=200):string {
 return (Array.isArray(value)?value[0]||'':value||'').slice(0,maxLength);
}
