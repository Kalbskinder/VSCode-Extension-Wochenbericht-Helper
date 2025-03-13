import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    // Statusbar für Zeichen- und Wortzählung
    let statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.tooltip = "Char & Wordcount";
    context.subscriptions.push(statusBar);

    // Event Listener für Auswahl-Änderungen
    let disposable = vscode.window.onDidChangeTextEditorSelection(updateStatusBar);
    context.subscriptions.push(disposable);

    function updateStatusBar() {
        let editor = vscode.window.activeTextEditor;
        if (!editor) {
            statusBar.hide();
            return;
        }
    
        let selection = editor.selection;
        let text = editor.document.getText(selection);
    
        if (text.length > 0) {
            // Remove HTML tags
            let cleanText = text
                .replace(/\n/g, " ")
                .replace(/>\s+</g, "> <")
                .replace(/<\/?[^>]+(>|$)/g, "")
                .replace(/\s+/g, " ")
                .trim();
            let wordCount = cleanText.trim().split(/\s+/).filter(word => word.length > 0).length;
            let charCount = cleanText.length;
    
            statusBar.text = `$(pencil) ${charCount} Zeichen, ${wordCount} Wörter`;
            statusBar.show();
        } else {
            statusBar.hide();
        }
    }
    
    updateStatusBar();

    // Sidebar hinzufügen
    const treeDataProvider = new SidebarProvider();
    vscode.window.registerTreeDataProvider('textCounterPanel', treeDataProvider);

    // Befehl für den Button: Git Commit
    const openGitCommitPanelCommand = vscode.commands.registerCommand('extension.openGitCommitPanel', () => {
        vscode.window.showInputBox({ prompt: 'Enter your Git Commit message' }).then(commitMessage => {
            if (commitMessage) {
                const terminal = vscode.window.createTerminal("Git Commit");
                terminal.show();
                terminal.sendText("git add .");
                terminal.sendText(`git commit -m \"${commitMessage}\"`);
                terminal.sendText("git push --set-upstream origin $(git branch --show-current)");
            }
        });
    });

    // Befehl zum Erstellen eines neuen Wochenberichts
    const createWeeklyReportCommand = vscode.commands.registerCommand('extension.createWeeklyReport', async () => {
        const input = await vscode.window.showInputBox({ prompt: 'Gib die Kalenderwoche ein (z.B. 12)' });
        if (!input) {
            vscode.window.showErrorMessage("Keine Kalenderwoche eingegeben!");
            return;
        }

        const year = new Date().getFullYear();
        const weekNumber = input.padStart(2, '0'); // 1-stellige KW in zweistellige umwandeln
        const fileName = `kw_${weekNumber}_${year}.html`;
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

        if (!workspaceFolder) {
            vscode.window.showErrorMessage("Kein geöffnetes Projekt gefunden!");
            return;
        }

        const easyCommitFolder = path.join(workspaceFolder, '.easy-commit');
        
        if (!fs.existsSync(easyCommitFolder)) {
            fs.mkdirSync(easyCommitFolder);
            console.log('.easy-commit Ordner wurde erstellt');
        }

        const templatePath = path.join(workspaceFolder, '.easy-commit', 'template.html');
        const newFilePath = path.join(workspaceFolder, fileName);

        if (!fs.existsSync(templatePath)) {
            vscode.window.showErrorMessage("Vorlage 'template.html' nicht gefunden! Lege sie in '.easy-commit' ab.");
            return;
        }

        // Template einlesen und anpassen
        let templateContent = fs.readFileSync(templatePath, 'utf8');
        templateContent = templateContent
        .replace(/Wochenbericht KW[^ ]+ \d{4}/g, `Wochenbericht KW${weekNumber} ${year}`)
        .replace(
                /<h2>Tagesreflexionen<\/h2>[\s\S]*?(?=<h2>|$)/, 
                `<h2>Tagesreflexionen</h2>\n${getFormattedDatesForWeek(parseInt(weekNumber), year)}`
            );
            
        fs.writeFileSync(newFilePath, templateContent, 'utf8');
        vscode.window.showInformationMessage(`Neuer Wochenbericht erstellt: ${fileName}`);

        // Datei im Editor öffnen
        const document = await vscode.workspace.openTextDocument(newFilePath);
        await vscode.window.showTextDocument(document);

        await vscode.commands.executeCommand('editor.action.formatDocument');
    });

    context.subscriptions.push(openGitCommitPanelCommand);
    context.subscriptions.push(createWeeklyReportCommand);
}

// Sidebar Provider
class SidebarProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(): vscode.TreeItem[] {
        const commitButton = new vscode.TreeItem("Commit Wochenbericht", vscode.TreeItemCollapsibleState.None);
        commitButton.command = {
            command: "extension.openGitCommitPanel",
            title: "Open Git Commit Panel"
        };
        commitButton.iconPath = new vscode.ThemeIcon('github');

        const createReportButton = new vscode.TreeItem("Neuen Wochenbericht erstellen", vscode.TreeItemCollapsibleState.None);
        createReportButton.command = {
            command: "extension.createWeeklyReport",
            title: "Create Weekly Report"
        };
        createReportButton.iconPath = new vscode.ThemeIcon('new-file');

        return [commitButton, createReportButton];
    }
}

// Funktion zum Berechnen der Datumswerte für die Tagesreflexionen
function getFormattedDatesForWeek(weekNumber: number, year: number): string {
    // ISO 8601 Wochensystem: Der erste Montag des Jahres
    const firstDayOfYear = new Date(year, 0, 1);
    // Berechne den Tag der Woche für den 1. Januar
    const dayOfWeek = firstDayOfYear.getDay();
    // Wenn der 1. Januar auf ein Sonntag fällt, dann müssen wir den ersten Montag am 2. Januar suchen
    const daysToFirstMonday = (dayOfWeek === 0 ? 1 : 1 - dayOfWeek);
    
    // Setze das Datum auf den ersten Montag des Jahres
    firstDayOfYear.setDate(firstDayOfYear.getDate() + daysToFirstMonday);
    
    // Berechne den Montag der gewünschten Kalenderwoche
    const weekStart = new Date(firstDayOfYear);
    weekStart.setDate(weekStart.getDate() + (weekNumber - 1) * 7); // Wochenoffset
    
    const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
    const months = [
        'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
        'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];

    // Erstelle die HTML-Tags für jeden Wochentag
    return days.map((day, index) => {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + index);

        const dayNumber = date.getDate();
        const monthName = months[date.getMonth()];
        return `<strong>BBW, ${day}, ${dayNumber}. ${monthName} ${year}</strong><br>\nTagesreflektion (min. 200 und max. 500 Zeichen)\n<hr>`;
    }).join("\n");
}



export function deactivate() {}
