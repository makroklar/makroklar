-- Speicher für Gerichtsfotos. Supabase Storage setzt Größe und Dateityp serverseitig durch,
-- auch gegen Clients, die den Foto-Editor umgehen: höchstens 5 MB und nur die Formate,
-- die der Editor erzeugt (JPEG, WebP; PNG als Ersatz, wo der Browser kein WebP schreiben kann).
-- Noch ohne Policies: damit darf vorerst niemand außer dem Service-Key lesen oder schreiben.
-- Lese- und Upload-Policies je Restaurant folgen mit dem eigentlichen Upload.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dish-photos', 'dish-photos', false, 5 * 1024 * 1024, array['image/jpeg', 'image/webp', 'image/png']);

commit;
