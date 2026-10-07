import {Fragment,type ReactNode} from "react";
function inline(text:string):ReactNode[] {
 const chunks=text.split(/(\[[^\]]+\]\([^\s)]+\)|\*\*[^*]+\*\*|\x60[^\x60]+\x60)/g);
 return chunks.map((chunk,i)=>{
  const link=chunk.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
  if(link) {
   const href=link[2];const safe=/^https?:\/\//i.test(href)||/^\/[^\/]/.test(href)||href.startsWith("mailto:");
   return safe?<a key={i} href={href} className="text-[var(--accent)] underline underline-offset-2" rel="noreferrer">{link[1]}</a>:<Fragment key={i}>{link[1]}</Fragment>;
  }
  if(chunk.startsWith("**")&&chunk.endsWith("**"))return <strong key={i}>{chunk.slice(2,-2)}</strong>;
  if(chunk.startsWith("\x60")&&chunk.endsWith("\x60"))return <code key={i} className="rounded bg-[var(--surface-subtle)] px-1">{chunk.slice(1,-1)}</code>;
  return <Fragment key={i}>{chunk}</Fragment>;
 });
}
export function DocumentContent({content}:{content:string}) {
 const lines=content.split("\n");const blocks:ReactNode[]=[];
 for(let i=0;i<lines.length;i++) {
  const line=lines[i].trim();if(!line)continue;
  const heading=line.match(/^(#{1,4})\s+(.+)$/);
  if(heading){const text=inline(heading[2]);blocks.push(heading[1].length===1?<h2 key={i} className="mb-3 mt-7 text-xl font-semibold">{text}</h2>:<h3 key={i} className="mb-2 mt-6 font-semibold">{text}</h3>);continue;}
  if(line.startsWith("|")) {
   const rows:string[][]=[];
   while(i<lines.length&&lines[i].trim().startsWith("|")){const row=lines[i].trim().replace(/^\||\|$/g,"").split("|").map(x=>x.trim());if(!row.every(x=>/^:?-+:?$/.test(x)))rows.push(row);i++;}
   i--;
   blocks.push(<div key={i} className="my-4 overflow-x-auto"><table className="w-full text-left text-sm"><tbody>{rows.map((r,j)=><tr key={j}>{r.map((cell,k)=>j===0?<th key={k} className="border-b border-[var(--border)] p-2">{inline(cell)}</th>:<td key={k} className="border-b border-[var(--border)] p-2 align-top">{inline(cell)}</td>)}</tr>)}</tbody></table></div>);continue;
  }
  if(/^[-*]\s|^\d+\.\s/.test(line)){const items:string[]=[];const ordered=/^\d+\./.test(line);const start=i;
   while(i<lines.length&&(ordered?/^\s*\d+\.\s/:/^\s*[-*]\s/).test(lines[i])){items.push(lines[i].trim().replace(/^[-*]\s|^\d+\.\s/,""));i++;}i--;
   const children=items.map((x,j)=><li key={j}>{inline(x)}</li>);
   blocks.push(ordered?<ol key={start} className="my-3 list-decimal space-y-2 pl-6">{children}</ol>:<ul key={start} className="my-3 list-disc space-y-2 pl-6">{children}</ul>);continue;
  }
  if(line==="---"){blocks.push(<hr key={i} className="my-6 border-[var(--border)]"/>);continue;}
  blocks.push(<p key={i} className="mb-3 leading-relaxed">{inline(line.replace(/^>\s?/,""))}</p>);
 }
 return <>{blocks}</>;
}

