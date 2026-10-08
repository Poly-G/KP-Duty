import type {ReactNode} from 'react';
import Image from 'next/image';
import type {ClientDeliverable} from '@/modules/deliverables/types';
import type {Progress} from '@/modules/project-collaboration/queries';
import type {PortalFile,PortalMessage} from '@/modules/client-portal/projection';
import {DeliverableClientView} from './deliverable-client-view';
import styles from './solta-portal.module.css';

export function SoltaPortal({name,progress,files,messages,deliverables,practice=false,children}:{
 name:string;progress:Progress|null;files:PortalFile[];messages:PortalMessage[];deliverables:ClientDeliverable[];practice?:boolean;children?:ReactNode;
}) {
 const shared=files.filter(f=>f.audience==='client'&&f.state==='ready');
 const visibleMessages=messages.filter(m=>m.audience==='client');
 return <div className={styles.portal}>
  <header><Image src="/solta/logo-light.svg" alt="Solta" width={100} height={40}/><nav aria-label="Your project">{children?<><a href="#onboarding">Onboarding</a><a href="#requests">Requests</a></>:null}<a href="#progress">Progress</a><a href="#review">Reviews</a><a href="#files">Files</a><a href="#messages">Messages</a></nav></header>
  <div className={styles.intro}><p className={styles.eyebrow}>Your project with Solta Works</p><h1>{name}</h1><p className="mt-5 max-w-xl">Everything you need to keep your project moving, <span className={styles.highlight}>one step at a time.</span></p></div>
  <section className={styles.next}><h2>Your next step</h2><p>{progress?.next_action||'No action needed right now. Your team will share the next step here.'}</p></section>
  <div className={styles.body}><div>
   <section id="progress" className={styles.block}><h2>Your progress</h2><p>{progress?.current_work||'Your team hasn’t published a progress update yet.'}</p>{progress?<ol className="mt-6 space-y-4">{progress.milestones.map((m,i)=><li key={i} className="flex flex-wrap justify-between gap-3"><span>{m.title}</span><span className="text-sm text-[#4a4f5c]">{m.status==='complete'?'Complete':m.status==='in_progress'?'In progress':'Upcoming'}</span></li>)}</ol>:null}</section>
   <section id="review" className={styles.block}><h2>Ready for your review</h2><DeliverableClientView deliverables={deliverables} files={shared} practice={practice}/></section>
  </div><div>
   <section id="files" className={styles.block}><h2>Your shared files</h2>{shared.length?<ul className="space-y-4">{shared.map(f=><li key={f.id}>{practice?<span>{f.name} (sample)</span>:<a href={f.drive_url||`/api/v1/project-files/${f.id}`}>{f.name}</a>}<p className="text-sm text-[#4a4f5c]">Version {f.version}</p></li>)}</ul>:<p>No files shared yet.</p>}</section>
   <section id="messages" className={styles.block}><h2>From your team</h2>{visibleMessages.length?<div className="space-y-5">{visibleMessages.map(m=><article key={m.id}><p className="whitespace-pre-wrap">{m.body}</p><p className="mt-2 text-sm text-[#4a4f5c]">Solta team · {new Date(m.created_at).toLocaleDateString('en-US',{timeZone:'UTC'})}</p></article>)}</div>:<p>No messages yet.</p>}</section>
  </div></div>{children}<footer>Solta Works · <a href="mailto:contact@soltaworks.com">contact@soltaworks.com</a></footer>
 </div>;
}
