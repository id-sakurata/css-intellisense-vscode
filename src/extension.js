const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

let cssClasses = {};
let cssFolders = [];
let cssFiles = [];
let autoSearch = false;

function activate(context) {
    vscode.workspace.onDidChangeConfiguration(() => {
        loadSettings();
    });

    loadSettings();

    // Command untuk menambahkan folder CSS
    let addFolderCommand = vscode.commands.registerCommand('cssIntellisense.addFolder', async (uri) => {
        if (uri && uri.fsPath) {
            addCssFolder(uri.fsPath);
        } else {
            const folderUri = await vscode.window.showOpenDialog({
                canSelectFolders: true,
                canSelectMany: false
            });

            if (folderUri && folderUri.length > 0) {
                addCssFolder(folderUri[0].fsPath);
            } else {
                vscode.window.showErrorMessage('No folder selected');
            }
        }
    });

    // Command untuk menambahkan file CSS
    let addFileCommand = vscode.commands.registerCommand('cssIntellisense.addFile', async (uri) => {
        if (uri && uri.fsPath) {
            addCssFile(uri.fsPath);
        } else {
            const fileUri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                filters: {
                    'CSS Files': ['css']
                },
                canSelectMany: false
            });

            if (fileUri && fileUri.length > 0) {
                addCssFile(fileUri[0].fsPath);
            } else {
                vscode.window.showErrorMessage('No file selected');
            }
        }
    });

    let refreshCacheCommand = vscode.commands.registerCommand('cssIntellisense.refreshCache', () => {
        refreshCache();
    });

    let clearCacheCommand = vscode.commands.registerCommand('cssIntellisense.clearCache', () => {
        clearCache();
    });

    context.subscriptions.push(addFolderCommand, addFileCommand, refreshCacheCommand, clearCacheCommand);

    if (autoSearch) {
        searchCssInWorkspace();
    }

    // Register completion provider for HTML, PHP, and Vue
    let completionProvider = vscode.languages.registerCompletionItemProvider(['html', 'php', 'vue'], {
        provideCompletionItems(document, position) {
            let completionItems = [];
            let lineText = document.lineAt(position).text;

            // Cek apakah baris tersebut mengandung class=""
            let classAttrPattern = /class=["']([^"']*)$/;
            let match = classAttrPattern.exec(lineText.substring(0, position.character));

            if (match) {
                let existingClasses = match[1].split(/\s+/);
                let prefix = existingClasses.pop() || '';

                // Tambahkan item auto-complete dari cache CSS yang cocok dengan prefix
                for (const [clsName, fileName] of Object.entries(cssClasses)) {
                    if (clsName.startsWith(prefix)) {
                        let completionItem = new vscode.CompletionItem(clsName, vscode.CompletionItemKind.Class);
                        completionItem.detail = `From ${fileName}`;
                        completionItems.push(completionItem);
                    }
                }
            }

            return completionItems;
        }
    }, '"', '\''); // Auto-complete akan dipicu ketika ada karakter kutip ganda atau tunggal

    context.subscriptions.push(completionProvider);

    // Fungsi untuk menambahkan folder CSS
    function addCssFolder(folderPath) {
        if (!cssFolders.includes(folderPath)) {
            cssFolders.push(folderPath);
        }

        vscode.window.setStatusBarMessage(`CSS Intellisense - Start scanning folder: ${folderPath}`, 2000); // Tampilkan pesan "Start"
        
        function scanFolder(folder) {
            fs.readdir(folder, { withFileTypes: true }, (err, files) => {
                if (err) {
                    vscode.window.showErrorMessage(`Error reading folder ${folder}: ${err.message}`);
                    return;
                }

                files.forEach(file => {
                    let filePath = path.join(folder, file.name);
                    
                    if (file.isDirectory()) {
                        // Rekursif jika ini adalah folder
                        scanFolder(filePath);
                    } else if (file.name.endsWith('.css')) {
                        // Pindai file CSS jika ditemukan
                        extractClasses(filePath);
                    }
                });
            });
        }

        // Mulai pemindaian folder rekursif
        scanFolder(folderPath);

        vscode.window.setStatusBarMessage(`CSS Intellisense - Completed scanning folder: ${folderPath}`, 2000); // Tampilkan pesan "Complete"
    }

    // Fungsi untuk menambahkan file CSS
    function addCssFile(filePath) {
        if (!cssFiles.includes(filePath)) {
            cssFiles.push(filePath);
        }

        vscode.window.setStatusBarMessage(`CSS Intellisense - Adding file: ${filePath}`, 2000); // Tampilkan pesan "Start"
        extractClasses(filePath);
        vscode.window.setStatusBarMessage(`CSS Intellisense - Completed adding file: ${filePath}`, 2000); // Tampilkan pesan "Complete"
    }

    // Fungsi untuk me-refresh cache CSS
    function refreshCache() {
        cssClasses = {};
        cssFolders.forEach(folder => addCssFolder(folder));
        cssFiles.forEach(file => addCssFile(file));
        vscode.window.showInformationMessage('CSS Intellisense: Cache refreshed');
    }

    // Fungsi untuk membersihkan cache CSS
    function clearCache() {
        cssClasses = {};
        cssFolders = [];
        cssFiles = [];
        vscode.window.showInformationMessage('CSS Intellisense: Cache cleared');
    }

    // Fungsi untuk mengekstrak kelas CSS dari file CSS
    function extractClasses(filePath) {
        fs.readFile(filePath, 'utf-8', (err, data) => {
            if (err) {
                vscode.window.showErrorMessage(`Error reading ${filePath}: ${err.message}`);
                return;
            }
            
            let classes = data.match(/\.[a-zA-Z0-9_-]+/g) || [];
            let fileName = path.basename(filePath);

            classes.forEach(cls => {
                let className = cls.slice(1); // Remove dot (.)
                if (!cssClasses[className]) {
                    cssClasses[className] = fileName;
                }
            });

            // Tambahkan log untuk memeriksa kelas yang diekstrak
            // console.log(`Extracted classes from ${filePath}:`, classes);
        });
    }

    // Fungsi untuk mencari file CSS di dalam workspace
    function searchCssInWorkspace() {
        if (vscode.workspace.workspaceFolders) {
            vscode.workspace.workspaceFolders.forEach(folder => {
                addCssFolder(folder.uri.fsPath);
            });
        }
    }

    // Fungsi untuk memuat pengaturan
    function loadSettings() {
        let config = vscode.workspace.getConfiguration('cssIntellisense');
        cssFolders = config.get('css_folders', []); // Mendapatkan daftar folder CSS
        cssFiles = config.get('css_files', []); // Mendapatkan daftar file CSS
        autoSearch = config.get('auto_search', false); // Mengatur autoSearch
    }
}

exports.activate = activate;
exports.deactivate = () => {};
