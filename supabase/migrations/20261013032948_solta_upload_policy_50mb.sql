-- Align the direct client upload path; staff server-action uploads retain 20 MB.
-- Private storage, project authorization, hashes and publication gates are retained.
alter table public.solta_portal_files drop constraint solta_portal_files_size_bytes_check;
alter table public.solta_portal_files add constraint solta_portal_files_size_bytes_check check(size_bytes between 1 and 52428800);
alter table public.solta_portal_files drop constraint solta_portal_files_mime_type_check;
alter table public.solta_portal_files add constraint solta_portal_files_mime_type_check check(mime_type in (
 'application/pdf','image/png','image/jpeg','image/heic','image/heif','text/plain','text/csv','image/svg+xml',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
));
update storage.buckets set file_size_limit=52428800,allowed_mime_types=array[
 'application/pdf','image/png','image/jpeg','image/heic','image/heif','text/plain','text/csv','image/svg+xml',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
] where id='kp-project-files';
