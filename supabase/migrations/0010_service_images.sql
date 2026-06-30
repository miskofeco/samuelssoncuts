alter table public.services
add column if not exists image_url text;

update public.services
set image_url = case
  when lower(name) like '%signature%' then '/signature.jpg'
  when lower(name) like '%beard%' and (lower(name) like '%cut%' or name like '%+%') then '/beard-plus-cut.jpg'
  when lower(name) like '%beard%' then '/beard-shape.jpg'
  else image_url
end
where image_url is null;
