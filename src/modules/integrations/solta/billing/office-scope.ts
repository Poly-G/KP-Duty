export function assertOfficePaymentScope(service:string,currentScopeId:string|undefined,approvedScopeIds:string[],requestScopeId?:string|null){
 if(service!=='less_office')return;
 if(!currentScopeId||!approvedScopeIds.includes(currentScopeId))throw new Error('Approve the current office-work scope before requesting payment.');
 if(requestScopeId&&requestScopeId!==currentScopeId)throw new Error('Scope changed. Approve the current scope and prepare a new payment request.');
}
