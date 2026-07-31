alter table checkin_lists
  add column if not exists category text;

update checkin_lists
set category = case
  when name ~* '(breakfast|lunch|dinner|\mtea\M|coffee)' then 'food_drink'
  when list_purpose = 'collection' then 'goods_kits'
  else 'entry_access'
end
where category is null;

alter table checkin_lists
  alter column category set not null;

alter table checkin_lists
  add constraint checkin_lists_category_check
    check (category in ('entry_access', 'food_drink', 'goods_kits'));
