// Import ALL exam marks from the verified PDF results
// Run: node scripts/import-all-marks.mjs

import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import fs from "fs";

const SUPABASE_URL = "https://jmdwxymbgxwdsmcwbahp.supabase.co";
const envFile = fs.readFileSync(".env.local", "utf8");
const SUPABASE_SERVICE_ROLE_KEY = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const EVENT_ID = "9f1e659b-6809-4502-b3c1-b0a98175e813";

// All marks from "122 FMAS Result.pdf" — verified final results
// [regNo, viva, publication, practical, result, remarks]
// null marks = absent from practical exam
const ALL_MARKS = [
  // Page 1
  ["122A1001", 8, 4, 7, "pass", null],         // Shivani Shah → 62
  ["122A1002", 8, 5, 6, "pass", null],         // Dhruvkumar Makwana → 57
  ["122A1003", 0, 1, 6, "fail", "No experience"], // Krishna Patel → 42
  ["122A1004", 7, 5, 5, "pass", null],         // Anjali Aghera → 55
  ["122A1006", 6, 3, 6, "pass", null],         // Kinjal Rathod → 59
  ["122A1007", 6, 3, 5, "pass", null],         // Smit Bhadja → 58
  ["122A1008", 8, 0, 6, "pass", null],         // Alis Khachar → 54
  ["122A1009", 8, 2, 7, "pass", null],         // Biradar Hemant → 54
  ["122A1011", 7, 1, 5, "pass", null],         // Avanita Bharathania → 52
  ["122A1012", 7, 0, 5, "pass", null],         // Reena Avkire → 51
  ["122A1013", 6, 1, 6, "pass", null],         // Maitrik Patel → 52
  ["122A1014", 6, 1, 6, "pass", null],         // Avinash Surushe → 52
  ["122A1015", 7, 0, 6, "pass", null],         // Parth Makadiya → 54
  ["122A1016", 7, 0, 5, "fail", null],         // Riya Talati → 47
  ["122A1017", 5, 0, 6, "pass", null],         // Parth Patel → 50
  ["122A1018", 5, 5, 5, "pass", null],         // Rajani Makarand Gosavi → 54
  ["122A1019", 6, 5, 6, "pass", null],         // Shalmali Gosavi → 55
  ["122A1020", 7, 3, 6, "pass", null],         // Priyanka Kamdar → 58
  ["122A1021", 5, 5, 7, "pass", null],         // Aditya Nimbkar → 56
  ["122A1022", 8, 4, 6, "pass", null],         // Rhishikesh Raghuvanshi → 57
  ["122A1023", 5, 1, 7, "pass", null],         // Jahnavi Anne → 52
  // Page 2
  ["122A1024", 8, 1, 7, "pass", null],         // Sneha Bora → 51
  ["122A1025", 7, 0, 7, "pass", null],         // Khyati Myatra → 50
  ["122A1026", 9, 2, 7, "pass", null],         // Stuti Shah → 57
  ["122A1027", 7, 1, 6, "pass", null],         // Astha Kaushal → 53
  ["122A1028", 5, 0, 6, "fail", "No experience"], // Keval Patel → 46
  ["122A1029", 5, 0, 6, "pass", null],         // Raajavi Shah → 50
  ["122A1030", 8, 3, 6, "pass", null],         // Rajvee Shukla → 55
  ["122A1032", null, null, null, "absent", null], // Sakthi Madhubala → absent
  ["122A1034", 6, 4, 6, "pass", null],         // Dipika Nannaware → 57
  ["122A1035", 9, 5, 5, "pass", null],         // Devang Patel → 57
  ["122A1036", 8, 3, 7, "pass", null],         // Indrani Rajput → 54
  ["122A1037", 6, 2, 6, "pass", null],         // Samarth Jain → 57
  ["122A1038", 7, 5, 6, "pass", null],         // Pavankumar Khunt → 60
  ["122A1039", 8, 5, 8, "pass", null],         // Prajakta Shende → 66
  ["122A1040", 8, 5, 5, "pass", null],         // Ujjavalkumar Ranpariya → 57
  ["122A1041", 6, 3, 6, "pass", null],         // Shravan Bg → 50
  ["122A1042", 7, 0, 5, "pass", null],         // Prachi Pillai → 54
  ["122A1043", 6, 4, 6, "pass", null],         // Vaishvi Patel → 57
  ["122A1044", 5, 1, 5, "fail", null],         // Shyam Dhrangu → 46
  ["122A1045", 5, 1, 6, "pass", null],         // Deep Patel → 50
  ["122A1046", 8, 0, 6, "pass", null],         // Rahul Sha → 53
  ["122A1047", 5, 1, 5, "fail", null],         // Vinay K → 46
  // Page 3
  ["122A1048", 6, 3, 6, "pass", null],         // Vignesh S → 54
  ["122A1049", 6, 3, 6, "pass", null],         // Ishitaba Jadeja → 59
  ["122A1050", 6, 3, 5, "pass", null],         // Ashishkumar Katara → 51
  ["122A1051", 7, 5, 5, "pass", null],         // Shruti Kachoria → 56
  ["122A1052", 6, 5, 6, "pass", null],         // Swapnil Mavchi → 60
  ["122A1053", 5, 1, 5, "fail", null],         // Ganesh Patil → 47
  ["122A1054", 8, 4, 6, "pass", null],         // Sagar Jaware → 58
  ["122A1055", 7, 0, 6, "fail", null],         // Jainabbanu Khatri → 49
  ["122A1056", 7, 3, 6, "pass", null],         // Avinash Dhumal → 57
  ["122A1057", 9, 5, 10, "pass", null],        // Kokila B T → 63
  ["122A1058", 8, 5, 5, "pass", null],         // Shreyans Patel → 57
  ["122A1059", 7, 0, 7, "pass", null],         // Hemisha Gandhi → 53
  ["122A1060", 6, 1, 7, "pass", null],         // Sneha Chila → 54
  ["122A1061", 6, 5, 5, "pass", null],         // Jayakumar G → 56
  ["122A1062", 8, 5, 6, "pass", null],         // Pratik Jadhav → 57
  ["122A1063", 6, 4, 6, "pass", null],         // Dhwani Parmar → 52
  ["122A1064", 8, 5, 5, "pass", null],         // Sapna Purushotham → 59
  ["122A1065", 8, 5, 6, "pass", null],         // Deep Shah → 63
  ["122A1066", 7, 0, 6, "pass", null],         // Aishwarya Champaneria → 57
  ["122A1067", 7, 4, 5, "pass", null],         // Sarver Hussain → 55
  ["122A1068", 8, 0, 7, "pass", null],         // Abhilash Joshi → 58
  // Page 4
  ["122A1069", 6, 0, 6, "pass", null],         // Hemant Pawar → 50
  ["122A1070", 7, 2, 5, "pass", null],         // Kundena Srilakshmi → 54
  ["122A1071", 8, 1, 8, "pass", null],         // Jyoti Kala → 56
  ["122A1072", 7, 1, 6, "pass", null],         // Rambabu Sirisilla → 53
  ["122A1073", 7, 2, 5, "pass", null],         // Swapna Mudigonda → 55
  ["122A1074", 8, 2, 5, "pass", null],         // Maaz Qureshi → 55
  ["122A1075", 6, 0, 6, "pass", null],         // Abhilash Nair → 51
  ["122A1076", 5, 0, 6, "pass", null],         // Mohammed Jouhar → 53
  ["122A1077", 6, 3, 5, "pass", null],         // Supriya Borole → 53
  ["122A1078", 7, 4, 6, "pass", null],         // Rachana Barkale → 52
  ["122A1079", 6, 4, 6, "pass", null],         // Sudha Bhimavarapu → 58
  ["122A1080", 5, 1, 6, "pass", null],         // Prasidh Shetty → 55
  ["122A1081", 6, 1, 6, "pass", null],         // Priyanka Rane → 56
  ["122A1082", 6, 1, 6, "pass", null],         // Mohit Maniya → 50
  ["122A1084", 8, 5, 5, "pass", null],         // Sudhir Kavad → 56
  ["122A1085", 7, 5, 5, "pass", null],         // Avinash Surwade → 57
  ["122A1086", 6, 2, 6, "pass", null],         // Robbins Sebastian → 53
  ["122A1087", 7, 5, 5, "pass", null],         // Yadukrishna S → 52
  ["122A1088", 7, 2, 6, "pass", null],         // Kumar Ss → 50
  ["122A1089", 8, 3, 6, "pass", null],         // Satyendra Thombare → 55
  ["122A1091", 7, 5, 6, "pass", null],         // Srikantha R → 56
  // Page 5
  ["122A1092", 5, 0, 6, "pass", null],         // Sriharsha B → 50
  ["122A1093", 6, 1, 6, "pass", null],         // Kalpan Patel → 51
  ["122A1094", 6, 2, 5, "pass", null],         // Savankumar Shah → 51
  ["122A1095", 5, 3, 5, "pass", null],         // Nidhi Patel → 52
  ["122A1096", 7, 4, 7, "pass", null],         // Sejal Kulkarni → 56
  ["122A1097", 6, 0, 5, "fail", null],         // Hiteshkumar Rathva → 46
  ["122A1098", 7, 4, 7, "pass", null],         // Amisha Dogra → 57
  ["122A1099", 8, 5, 6, "pass", null],         // Harikrishan Rathee → 59
  ["122A1100", 6, 3, 6, "pass", null],         // Mineshkumar Patel → 50
  ["122A1101", 6, 5, 6, "pass", null],         // Sujata Gatalwar → 56
  ["122A1102", 9, 2, 8, "pass", null],         // Krishna Dholariya → 64
  ["122A1103", 8, 4, 5, "pass", null],         // Kamal Gupta → 61
  ["122A1104", 8, 3, 6, "pass", null],         // Prutha Jadav → 58
  ["122A1105", 8, 5, 6, "pass", null],         // Natasha Mithiborwala → 54
  ["122A1106", 8, 5, 6, "pass", null],         // Tanveer Malek → 64
  ["122A1107", 0, 1, 5, "fail", "No experience"], // Saurav Damor → 42
  ["122A1108", 9, 4, 6, "pass", null],         // Meet Dave → 62
  ["122A1109", 6, 4, 6, "pass", null],         // Vipin Sharma → 55
  ["122A1110", 6, 3, 5, "pass", null],         // Rajdipsinh Solanki → 54
  ["122A1111", 6, 3, 6, "pass", null],         // Aditya Raval → 53
  ["122A1112", 6, 2, 5, "pass", null],         // Aseem Kumar Roy → 53
  // Page 6
  ["122A1113", 8, 5, 7, "pass", null],         // Vishal Patel → 59
  ["122A1114", 9, 5, 5, "pass", null],         // Mahesh Jadhav → 63
  ["122A1115", 7, 5, 6, "pass", null],         // Deep Patel → 57
  ["122A1116", 8, 5, 6, "pass", null],         // Anuroop Bhakkad → 57
  ["122A1117", 8, 5, 5, "pass", null],         // Jaswant Jaisankar → 63
  ["122A1118", 7, 5, 7, "pass", null],         // Rishi Sachdeva → 57
  ["122A1119", 7, 0, 5, "pass", null],         // Sandesh C G → 50
  ["122A1120", 6, 0, 6, "pass", null],         // Shrenik Kothari → 54
  ["122A1121", 5, 3, 6, "pass", null],         // Poonam Patil → 58
  ["122A1122", 6, 2, 6, "pass", null],         // Bhagyashree Joshi → 54
  ["122A1123", null, null, null, "absent", null], // Ishita Rathore → absent (Theory=36, quiz=7 only)
  ["122A1124", 6, 1, 5, "pass", null],         // Ashish Vaghasiya → 50
  ["122A1125", 5, 0, 6, "pass", null],         // Arun Maurya → 50
  ["122A1126", 6, 3, 6, "pass", null],         // Uzma Khan → 54
  ["122A1127", 6, 0, 6, "pass", null],         // Sanchit Sanghai → 54
  ["122A1128", 6, 0, 6, "pass", null],         // Dr.rakesh Pandey → 51
  ["122A1129", 7, 1, 5, "pass", null],         // Payalkumari Yogeshbhai Patel → 52
  ["122A1130", 5, 3, 6, "pass", null],         // Devarshi Bhagora → 52
  ["122A1131", 6, 0, 6, "pass", null],         // Nidhi Thumar → 54
  ["122A1132", 5, 3, 6, "pass", null],         // Shailvi Parikh → 52
  ["122A1133", 7, 1, 6, "pass", null],         // Brynivalentina Pereira → 56
  // Page 7
  ["122A1134", 7, 0, 5, "pass", null],         // Damor Ronakkumar → 50
  ["122A1135", 8, 5, 6, "pass", null],         // Shaunak Chacha → 61
  ["122A1136", 6, 4, 7, "pass", null],         // Dhwani Nanvani → 57
  ["122A1137", 7, 5, 7, "pass", null],         // Anuja Sachapara → 57
  ["122A1138", 8, 5, 5, "pass", null],         // Manish Chaudhari → 57
  ["122A1139", 7, 1, 5, "pass", null],         // Rishit Sondarava → 55
  ["122A1140", 5, 3, 5, "pass", null],         // Mital Bhakhar → 52
  ["122A1141", 7, 0, 6, "pass", null],         // Poojan Patel → 57
  ["122A1142", 7, 5, 6, "pass", null],         // Ranjitsinh Darbar → 54
  ["122A1144", 6, 0, 5, "pass", null],         // Rohankumar Ruparel → 53
  ["122A1145", 7, 1, 6, "pass", null],         // Rohan Jamanbhai Harsoda → 56
  ["122A1146", 8, 5, 5, "pass", null],         // Kush Mehta → 56
  ["122A1147", 7, 1, 6, "pass", null],         // Hiteshwari Arvindbhai Patel → 54
  ["122A1148", 5, 1, 5, "pass", null],         // Jainam Shah → 52
  ["122A1149", 8, 0, 6, "pass", null],         // Rana Parth → 57
  ["122A1150", 6, 0, 6, "pass", null],         // Aanal Bhoiwala → 50
  ["122A1151", 7, 5, 6, "pass", null],         // Nirajkumar Vahoniya → 53
  ["122A1152", 5, 0, 5, "fail", null],         // Bambhaniya Umeshkumar → 48
  ["122A1153", 5, 1, 6, "pass", null],         // Dhruvil Sutariya → 56
  ["122A1154", 7, 1, 9, "pass", null],         // Deba Ali Khan → 61
  // Page 8
  ["122A1155", 7, 2, 6, "pass", null],         // Shreeja Desai → 55
  ["122A1156", 9, 4, 5, "pass", null],         // Meet Desai → 55
  ["122A1157", 5, 5, 5, "pass", null],         // Drasti Sagar Patel → 54
  ["122A1158", 5, 3, 5, "pass", null],         // Priya Mansukhbhai Kanani → 52
  ["122A1159", 6, 0, 6, "pass", null],         // Manish Mittal → 51
  ["122A1160", 6, 1, 6, "pass", null],         // Jitali Rasiklal Patel → 52
  ["122A1161", 8, 5, 6, "pass", null],         // Raj Nitinkumar Vaidya → 60
  ["122A1162", 8, 5, 6, "pass", null],         // Zeel Bharat Thakkar → 54
  ["122A1163", 7, 3, 6, "pass", null],         // Smit Kaval Desai → 55
  ["122A1164", 6, 1, 6, "pass", null],         // Pooja Jain → 52
  ["122A1166", 8, 4, 5, "pass", null],         // Jay Pankajkumar Prajapati → 55
  ["122A1167", 6, 0, 6, "pass", null],         // Manashvi Gogri → 54
  ["122A1168", 5, 3, 6, "pass", null],         // Yadhneya Jairam Sonone → 53
  ["122A1171", 5, 1, 7, "pass", null],         // Aniket Kuldipak → 52
  ["122A1172", 7, 0, 5, "pass", null],         // Urvi Hitesh Antala → 51
  ["122A1173", 8, 5, 5, "pass", null],         // Dangarosia Raj Jamnadas → 57
  ["122A1174", null, null, null, "absent", null], // Anita Rani → absent (Total=0)
  ["122A1175", null, null, null, "pass", "WITHOUT EXAM"], // Milind Wadekar → 60 PASS special
];

async function run() {
  console.log(`\nImporting ${ALL_MARKS.length} exam marks from PDF...\n`);

  // Fetch all registrations for this event
  const { data: registrations, error: fetchError } = await supabase
    .from("registrations")
    .select("id, registration_number, attendee_name")
    .eq("event_id", EVENT_ID)
    .in("status", ["confirmed", "attended", "completed", "checked_in"]);

  if (fetchError) {
    console.error("Failed to fetch registrations:", fetchError.message);
    process.exit(1);
  }

  const regMap = new Map();
  for (const r of registrations) {
    regMap.set(r.registration_number, { id: r.id, name: r.attendee_name });
  }

  let success = 0, skipped = 0, errors = 0;

  for (const [regNo, viva, publication, practical, result, remarks] of ALL_MARKS) {
    const reg = regMap.get(regNo);
    if (!reg) {
      console.log(`  ⚠ NOT FOUND: ${regNo} — skipping`);
      skipped++;
      continue;
    }

    const isAbsent = viva === null && practical === null;

    let updateData;
    if (isAbsent && result === "absent") {
      updateData = {
        exam_marks: null,
        exam_total_marks: null,
        exam_result: "absent",
      };
    } else if (isAbsent && result === "pass") {
      // Special case: Milind Wadekar - PASS WITHOUT EXAM
      updateData = {
        exam_marks: { practical: 0, viva: 0, publication: 0, remarks: remarks },
        exam_total_marks: 0,
        exam_result: "pass",
      };
    } else {
      const total = viva + publication + practical;
      updateData = {
        exam_marks: {
          practical,
          viva,
          publication,
          ...(remarks ? { remarks } : {}),
        },
        exam_total_marks: total,
        exam_result: result,
      };
    }

    const { error: updateError } = await supabase
      .from("registrations")
      .update(updateData)
      .eq("id", reg.id);

    if (updateError) {
      console.log(`  ✗ ERROR: ${regNo} (${reg.name}) — ${updateError.message}`);
      errors++;
    } else {
      const total = isAbsent
        ? result === "pass" ? "PASS (WITHOUT EXAM)" : "ABSENT"
        : `${updateData.exam_total_marks} (${result.toUpperCase()})${remarks ? ` [${remarks}]` : ""}`;
      console.log(`  ✓ ${regNo} ${reg.name} → ${total}`);
      success++;
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`  Success: ${success}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors:  ${errors}`);
  console.log(`  Total:   ${ALL_MARKS.length}`);
}

run().catch(console.error);
