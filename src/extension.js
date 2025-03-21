const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

let cssClasses = {};
let cssFolders = [];
let cssFiles = [];
let autoSearch = false;
let supportedLanguages = [];

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

    let classAttrPatterns = [];

    // Menambahkan pola untuk HTML (class)
    classAttrPatterns.push(/class=["']([^"']*)$/);

    // Menambahkan pola untuk JSX/React (className)
    classAttrPatterns.push(/className=["']([^"']*)$/);

    function getClassFromLine(lineText, position) {
        for (let pattern of classAttrPatterns) {
            let match = pattern.exec(lineText.substring(0, position.character));
            if (match) {
                return match[1];  // Mengembalikan kelas yang ditemukan
            }
        }
        return null;  // Jika tidak ada pola yang cocok
    }

    // Register completion provider for dynamically fetched languages
    let completionProvider = vscode.languages.registerCompletionItemProvider(
        supportedLanguages, {
            provideCompletionItems(document, position) {
                let completionItems = [];
                let lineText = document.lineAt(position).text;
                let match = getClassFromLine(lineText, position);

                if (match) {
                    let existingClasses = match.split(/\s+/);
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
        },
        '"', '\''
    );

    context.subscriptions.push(completionProvider);

    // Fungsi untuk menambahkan folder CSS
    function addCssFolder(folderPath) {
        if (!cssFolders.includes(folderPath)) {
            cssFolders.push(folderPath);
        }

        vscode.window.setStatusBarMessage(`CSS Intellisense - Start scanning folder: ${folderPath}`, 2000);

        function scanFolder(folder) {
            fs.readdir(folder, { withFileTypes: true }, (err, files) => {
                if (err) {
                    vscode.window.showErrorMessage(`Error reading folder ${folder}: ${err.message}`);
                    return;
                }

                files.forEach(file => {
                    let filePath = path.join(folder, file.name);

                    if (file.isDirectory()) {
                        scanFolder(filePath);  // Rekursif jika ini adalah folder
                    } else if (file.name.endsWith('.css')) {
                        extractClasses(filePath);
                    }
                });
            });
        }

        scanFolder(folderPath);

        vscode.window.setStatusBarMessage(`CSS Intellisense - Completed scanning folder: ${folderPath}`, 2000);
    }

    // Fungsi untuk menambahkan file CSS
    function addCssFile(filePath) {
        if (!cssFiles.includes(filePath)) {
            cssFiles.push(filePath);
        }

        vscode.window.setStatusBarMessage(`CSS Intellisense - Adding file: ${filePath}`, 2000);
        extractClasses(filePath);
        vscode.window.setStatusBarMessage(`CSS Intellisense - Completed adding file: ${filePath}`, 2000);
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
                let className = cls.slice(1);  // Menghapus tanda titik (.)
                if (!cssClasses[className]) {
                    cssClasses[className] = fileName;
                }
            });
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
        cssFolders = config.get('css_folders', []);  // Mendapatkan daftar folder CSS
        cssFiles = config.get('css_files', []);  // Mendapatkan daftar file CSS
        autoSearch = config.get('auto_search', false);  // Mengatur autoSearch
        supportedLanguages = config.get('supported_languages', [
            'html', 'php', 'vue', 'javascriptreact', 'blade', 
            'edge', 'hbs', 'handlebars', 'ejs', 'twig', 'nunjucks'
        ]); // Mendapatkan bahasa yang didukung
    }
}

exports.activate = activate;
exports.deactivate = () => {};
