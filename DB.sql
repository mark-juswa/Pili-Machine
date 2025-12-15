-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.batches (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  device_id text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  finished_at timestamp with time zone,
  status text DEFAULT 'completed'::text,
  note text,
  CONSTRAINT batches_pkey PRIMARY KEY (id)
);

CREATE TABLE public.nut_readings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  batch_id bigint NOT NULL,
  timestamp timestamp with time zone DEFAULT now(),
  weight double precision NOT NULL,
  raw_value bigint,
  note text,
  CONSTRAINT nut_readings_pkey PRIMARY KEY (id),
  CONSTRAINT nut_readings_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id)
);
CREATE TABLE public.shell_readings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  batch_id bigint NOT NULL,
  timestamp timestamp with time zone DEFAULT now(),
  weight double precision NOT NULL,
  raw_value bigint,
  note text,
  CONSTRAINT shell_readings_pkey PRIMARY KEY (id),
  CONSTRAINT shell_readings_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id)
);