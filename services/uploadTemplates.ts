import { ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

async function uploadFile(file: File, filePath: string) {
  const fileRef = ref(storage, filePath);
  await uploadBytes(fileRef, file);
}

// Exemple d'utilisation
const excelFile = new File(["content"], "template.xlsx", {
  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
});
const wordFile = new File(["content"], "template.docx", {
  type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
});

uploadFile(excelFile, "templates/template.xlsx");
uploadFile(wordFile, "templates/template.docx");
