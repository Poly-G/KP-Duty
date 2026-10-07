import {inflateRawSync} from 'node:zlib';
import ExcelJS from 'exceljs';
import {parseCsv} from './normalize.ts';
export async function leadFileTable(name:string,bytes:Buffer):Promise<string[][]>{
 if(!bytes.length||bytes.length>2*1024*1024)throw new Error('Use a CSV or XLSX file up to 2 MB.');
 if(/\.csv$/i.test(name)){const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(text.includes('\0'))throw new Error('Invalid CSV text.');return parseCsv(text);}
 if(!/\.xlsx$/i.test(name))throw new Error('Export Google Sheets as CSV or Excel (.xlsx). Convert older .xls files to .xlsx first.');
 // Bound the ZIP's declared inflated size before the workbook parser runs.
 let total=0,entries=0;
 for(let i=0;i+46<=bytes.length;i++){
  if(bytes.readUInt32LE(i)!==0x02014b50)continue;
  entries++;const size=bytes.readUInt32LE(i+24);const compressed=bytes.readUInt32LE(i+20);const length=bytes.readUInt16LE(i+28);const path=bytes.subarray(i+46,i+46+length).toString('utf8');const local=bytes.readUInt32LE(i+42);const method=bytes.readUInt16LE(i+10);
  if(entries>200||size===0xffffffff||compressed===0xffffffff||local+30>bytes.length||/vbaProject|externalLinks/i.test(path)||bytes.readUInt16LE(i+8)&1)throw new Error('Unsupported workbook. Export values to CSV.');
  if(bytes.readUInt32LE(local)!==0x04034b50)throw new Error('Invalid XLSX structure.');
  const start=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28);if(start+compressed>bytes.length)throw new Error('Invalid XLSX structure.');
  const data=bytes.subarray(start,start+compressed);const remaining=12*1024*1024-total;
  if(remaining<=0||size>remaining)throw new Error('Workbook expands beyond 12 MB. Export a smaller CSV.');
  const actual=method===0?data:method===8?inflateRawSync(data,{maxOutputLength:remaining}):null;
  if(!actual||actual.length!==size)throw new Error('Invalid XLSX compressed entry.');total+=actual.length;
  i+=45+length+bytes.readUInt16LE(i+30)+bytes.readUInt16LE(i+32);
 }
 if(!entries)throw new Error('Invalid XLSX workbook.');
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
 const sheets=workbook.worksheets.filter(sheet=>sheet.rowCount>0);if(sheets.length!==1)throw new Error('Use one populated worksheet per import.');
 const sheet=sheets[0];if(sheet.rowCount>511||sheet.columnCount>50)throw new Error('Use up to 500 leads and 50 columns.');
 const table:string[][]=[];sheet.eachRow(row=>{const values:string[]=[];for(let i=1;i<=sheet.columnCount;i++){const cell=row.getCell(i);if(cell.type===ExcelJS.ValueType.Formula)throw new Error('Formula cells are not imported. Export calculated values to CSV.');values.push(cell.text);}if(values.some(v=>v.trim()))table.push(values);});return table;
}
