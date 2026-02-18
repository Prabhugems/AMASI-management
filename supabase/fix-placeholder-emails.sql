-- Fix placeholder emails from Program CSV
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql
-- This updates faculty_assignments, registrations, and faculty tables

-- Step 1: Create a temp lookup table from CSV data
CREATE TEMP TABLE csv_emails (faculty_name TEXT, email TEXT, phone TEXT);

INSERT INTO csv_emails (faculty_name, email, phone) VALUES
('Dr Prakash Kumar Sasmal', 'drpksasmal@gmail.com', '9438884255'),
('Dr Rajesh Kumar Shrivastava', 'dr.rajeshshree70@gmail.com', '9925029477'),
('Dr Bhupinder Singh Pathania', 'surgeonpat@yahoo.co.uk', '9419190099'),
('Dr Rajendra Mandia', 'drrmandia@yahoo.com', '9414041728'),
('Dr Deborshi Sharma', 'drdeborshi@gmail.com', '9971539797'),
('Dr Srikant Patro', 'srikantkpatro@gmail.com', '9861215522'),
('Dr Jayanta Kumar Das', 'drjayantakr@yahoo.com', '9862569203'),
('Dr Vinayak Rengan', 'vinayak92@gmail.com', '9941275775'),
('Dr Kalpesh Jani', 'kvjani@gmail.com', '9924841240'),
('Dr Sameer Rege', 'drsamrege@gmail.com', '9869178040'),
('Dr Jugindra S', 'drjugindra@shijahospitals.com', '7005115381'),
('Dr Jayant K Das', 'drjayantakr@yahoo.com', '9862569203'),
('Dr Vishakha Kalikar', 'vish.kalikar@gmail.com', '9975634405'),
('Dr Eham Arora', 'ehamarora@gmail.com', '9769269907'),
('Dr Jignesh Gandhi', 'jigneshkem@gmail.com', '9920443433'),
('Dr Rahul Mahadar', 'rahulmahadar@yahoo.com', '9820234680'),
('Dr Bharath Cumar M', 'surgeonbharath@gmail.com', '9894064274'),
('Dr Pramod Shinde', 'shindepramodp@gmail.com', '9822060121'),
('Dr Roy Patankar', 'roypatankar@gmail.com', '9820075254'),
('Dr Suresh Chandra Hari', 'drsguduru@hotmail.com', '9848027177'),
('Dr Himanshu Yadav', 'drhimanshuyadav@gmail.com', '9897794208'),
('Dr Pinak Dasgupta', 'drpdg77@gmail.com', '8811091676'),
('Dr Sharad Sharma', 'drsharadsharma@gmail.com', '9619460808'),
('Dr Vikas Singhal', 'singhalvik@gmail.com', '8800593611'),
('Dr Vivek Bindal', 'bindal.vivek@gmail.com', '9999931958'),
('Dr C Palanivelu', 'info@geminstitute.in', '9843922322'),
('Dr Varghese C J', 'doctorthrissur@gmail.com', '9846031233'),
('Dr Manash Ranjan Sahoo', 'vc@ouhs.ac.in', '9937025779'),
('Dr Tushar Subhadarshan Mishra', 'surg_tushar@aiimsbhubaneswar.edu.in', '9438884251'),
('Dr Biswarup Bose', 'dr.biswarupbose@gmail.com', '9831001112'),
('Dr Parthasarathi', 'parthu@mac.com', '9842230900'),
('Dr Sreejoy Patnaik', 'sreejoypatnaik@gmail.com', '9831001112'),
('Dr Bikash Bihary Tripathy', 'pedsurg_bikasha@aiimsbhubaneswar.edu.in', '9938104876'),
('Dr Bana B Mishra', 'drbbm_orissa@rediffmail.com', '9437024977'),
('Dr Rashmi R Sahoo', 'drrashmi1278@gmail.com', '8763067172'),
('Dr Monika Gureh', 'surg_monika@aiimsbhubaneswar.edu.in', '8054340584'),
('Dr Ashok K Sahoo', 'drkashok@hotmail.com', '8800878271'),
('Dr Pradeep Kumar Singh', 'surg_pradeep@aiimsbhubaneswar.edu.in', '8789395345'),
('Dr P K Debata', 'pk_debata@yahoo.com', '9437078964'),
('Dr Amaresh Mishra', 'amareshm26@gmail.com', '9437554488'),
('Dr S Manwar Ali', 'surg_manwar@aiimsbhubaneswar.edu.in', '94388820340'),
('Dr Bikram Rout', 'surg_bikram@aiimsbhubaneswar.edu.in', '8763278543'),
('Dr Akash Bihari Pati', 'pedsurg_akash@aiimsbhubaneswar.edu.in', '9438884104'),
('Dr Shantanu Kumar Sahu', 'surg_shantanu@aiimsbhubaneswar.edu.in', '8218053761'),
('Dr P. Senthilnathan', 'senthilnathan94@gmail.com', '9842210173'),
('Dr Tamonas Chaudhuri', 'drtamonas@hotmail.com', '9830067567'),
('Dr Shakti Prasad Sahoo', 'srsahoo@hotmail.com', '9437025323'),
('Dr Jayant Kumar Dash', 'drjkdash@gmail.com', '8763066768'),
('Dr B M Das', 'drbhubandas@yahoo.co.in', '9338203485'),
('Dr Mithilesh K Sinha', 'surg_mithilesh@aiimsbhubaneswar.edu.in', NULL),
('Dr Rashmi Sahoo', 'drrashmi1278@gmail.com', '8763067172'),
('Dr Jayant Biswal', 'kasturiray69@gmail.com', '9437028485'),
('Dr Ranjit K Sahu', 'plastic_ranjit@aiimsbhubaneswar.edu.in', '9668044811');


-- Step 2: Preview what will be updated (RUN THIS FIRST to verify)
SELECT
  'faculty_assignments' AS table_name,
  fa.faculty_name,
  fa.faculty_email AS old_email,
  c.email AS new_email
FROM faculty_assignments fa
JOIN csv_emails c ON LOWER(TRIM(fa.faculty_name)) = LOWER(TRIM(c.faculty_name))
WHERE fa.faculty_email LIKE '%@placeholder.%'

UNION ALL

SELECT
  'registrations' AS table_name,
  r.attendee_name,
  r.attendee_email AS old_email,
  c.email AS new_email
FROM registrations r
JOIN csv_emails c ON LOWER(TRIM(r.attendee_name)) = LOWER(TRIM(c.faculty_name))
WHERE r.attendee_email LIKE '%@placeholder.%'

UNION ALL

SELECT
  'faculty' AS table_name,
  f.name,
  f.email AS old_email,
  c.email AS new_email
FROM faculty f
JOIN csv_emails c ON LOWER(TRIM(f.name)) = LOWER(TRIM(c.faculty_name))
WHERE f.email LIKE '%@placeholder.%'

ORDER BY table_name, old_email;


-- Step 3: UPDATE faculty_assignments (placeholder emails → real emails)
UPDATE faculty_assignments fa
SET
  faculty_email = c.email,
  faculty_phone = COALESCE(fa.faculty_phone, c.phone)
FROM csv_emails c
WHERE LOWER(TRIM(fa.faculty_name)) = LOWER(TRIM(c.faculty_name))
  AND fa.faculty_email LIKE '%@placeholder.%';


-- Step 4: UPDATE registrations (placeholder emails → real emails)
UPDATE registrations r
SET
  attendee_email = c.email,
  attendee_phone = COALESCE(r.attendee_phone, c.phone)
FROM csv_emails c
WHERE LOWER(TRIM(r.attendee_name)) = LOWER(TRIM(c.faculty_name))
  AND r.attendee_email LIKE '%@placeholder.%';


-- Step 5: UPDATE faculty table (placeholder emails → real emails)
UPDATE faculty f
SET
  email = c.email,
  phone = COALESCE(f.phone, c.phone)
FROM csv_emails c
WHERE LOWER(TRIM(f.name)) = LOWER(TRIM(c.faculty_name))
  AND f.email LIKE '%@placeholder.%';


-- Step 6: Verify results
SELECT 'Remaining placeholders in faculty_assignments' AS check_name,
  COUNT(*) AS count
FROM faculty_assignments
WHERE faculty_email LIKE '%@placeholder.%'

UNION ALL

SELECT 'Remaining placeholders in registrations',
  COUNT(*)
FROM registrations
WHERE attendee_email LIKE '%@placeholder.%'

UNION ALL

SELECT 'Remaining placeholders in faculty',
  COUNT(*)
FROM faculty
WHERE email LIKE '%@placeholder.%';


-- Cleanup
DROP TABLE IF EXISTS csv_emails;
