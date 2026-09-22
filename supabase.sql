-- Run this SQL in your Supabase SQL Editor to create the necessary table

create table todos (
  id uuid default gen_random_uuid() primary key,
  text text not null,
  completed boolean default false,
  assignee text check (assignee in ('both', 'me', 'you')) default 'both',
  due_date timestamp with time zone,
  is_all_day boolean default false,
  created_at timestamp with time zone default now()
);

-- Turn on Realtime for the todos table
alter publication supabase_realtime add table todos;
