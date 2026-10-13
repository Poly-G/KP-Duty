/** Compute time-sensitive status in the server data layer. */
export function schedulerHealth(s:{enabled:boolean;last_scan_at:string|null;last_started_at:string|null;last_completed_at:string|null;error_code:string|null}|null,now=Date.now()){
 const stale=!!s?.enabled&&(!s.last_scan_at||now-new Date(s.last_scan_at).getTime()>900000);
 const missedWorker=!!s?.enabled&&!!s.last_started_at&&(!s.last_completed_at||new Date(s.last_started_at).getTime()>new Date(s.last_completed_at).getTime())&&now-new Date(s.last_started_at).getTime()>600000;
 return stale||missedWorker||!!s?.error_code;
}
