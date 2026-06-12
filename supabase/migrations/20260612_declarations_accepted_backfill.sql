-- Phase C: declarations_accepted backfill + shape convergence.
--
-- The submit wizard used to write declarations_accepted as a boolean `true`,
-- but the column is JSONB with a `[]` default and every reader treats it as
-- an array (.length, .map, rendered as text). 4 pre-Phase-A rows are stored
-- as boolean and crash the admin detail page on render.
--
-- This migration rewrites those 4 rows to the same array-of-statement-text
-- convention used by the 9 array rows and the new wizard write path.

UPDATE abstracts
SET declarations_accepted = jsonb_build_array(
  'I confirm that this research was conducted in accordance with ethical standards and has received appropriate ethical approval where required.',
  'I confirm that this abstract is original work and has not been previously published or is not under consideration for publication elsewhere.',
  'I confirm that all co-authors have reviewed and approved this submission, and consent to their names being included.'
)
WHERE jsonb_typeof(declarations_accepted) = 'boolean';
