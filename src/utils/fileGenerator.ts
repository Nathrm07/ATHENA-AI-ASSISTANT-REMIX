import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";

export const generatePDF = (content: string, filename: string = "Research_Report.pdf", title: string = "Research Report") => {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(title, 15, 20);
  doc.setFontSize(12);
  const splitText = doc.splitTextToSize(content, 180);
  doc.text(splitText, 15, 35);
  doc.save(filename);
};

export const generateDocx = async (content: string, filename: string = "Research_Report.docx", title: string = "Research Report") => {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: title,
                bold: true,
                size: 32,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "\n",
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun(content),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
};
