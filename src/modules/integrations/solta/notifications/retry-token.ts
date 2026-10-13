/** Only the short-lived database-generated tick credential is accepted. */
export function retryToken(authorization:string|null){
 const match=/^Bearer ([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/.exec(authorization||'');
 return match?.[1]||null;
}
