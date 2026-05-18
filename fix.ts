import fs from 'fs';
import path from 'path';

const viewsDir = path.join(process.cwd(), 'src', 'views');
const files = fs.readdirSync(viewsDir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
    const filePath = path.join(viewsDir, file);
    let content = fs.readFileSync(filePath, 'utf-8');
    
    if (content.includes('getDocs(')) {
        content = content.replace(/getDocs\(/g, 'fastGetDocs(');
        if (content.includes('../firebase') && !content.includes('fastGetDocs')) {
            content = content.replace(/handleFirestoreError, OperationType/, 'handleFirestoreError, OperationType, fastGetDocs');
            content = content.replace(/handleFirestoreError, OperationType, offlineSafeDocWrite/, 'handleFirestoreError, OperationType, offlineSafeDocWrite, fastGetDocs');
        }
        fs.writeFileSync(filePath, content);
    }
}
