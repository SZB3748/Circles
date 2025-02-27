const CURSOR_CHARACTER = "\0\0";
const SELECTION_START_CHARACTER = "\0\x01";
const SELECTION_END_CHARACTER = "\0\x02";

const REGEX_LINE_FORMAT_ALL =
/(?<header>^(?<headerlevel>[#]{1,6})\x20(?<headertext>.+))|(?<url>(\[(?<urlname>.*)?\]\((?<urlhref>(?:https:\/\/)?(?<urldomain>[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b)(?<urlpath>[-a-zA-Z0-9()@:%_\+.~#?&\/=]*))\)))|(?<code3>[`]{3}(?<code3text>.+?)(?=[`]{3}(?:[^\n`]|$))[`]{3})|(?<code>`(?<codetext>.+?)(?=`(?:[^\n`]|$))`)|(?<bold>[*]{2}(?<boldtext>.+?)(?=[*]{2}(?:[^\n*]|$))[*]{2})|(?<italic>\*(?<italictext>.+?)(?=\*(?:[^\n*]|$))\*)|(?<under>[_]{2}(?<undertext>.+?)[_]{2})|(?<strike>[~]{2}(?<striketext>.+?)[~]{2})|(?<spoiler>[\|]{2}(?<spoilertext>.+?)[\|]{2})/g;

const REGEX_LINES_FORMAT_ALL = /(?<codeblock>[`]{3}(?<codeblocklang>.+?)?\n(?<codeblocktext>[\s\S]*?)(?=[`]{3}(?:[^\n`]|$))[`]{3})|(?<bullets>^[^\S\n]*(?:\-|[0-9]+\.).+(?:\n[^\S\n]*(?:\-|[0-9]+\.).+)*)/gm;

const REGEX_META_ALL = /\x00(?:\x00|\x01|\x02)/g;

/**
 * @param {string} line
 * @param {HTMLElement} dest
 * @param {string[]} excluded
 * @param {boolean|undefined} isInput
 */
function formatLine(line, dest, excluded, isInput) {
    let current = 0;
    for (const match of line.matchAll(REGEX_LINE_FORMAT_ALL)) {
        if (isInput)
            unescapeFormattedTextInput(line.slice(current, match.index), dest);
        else {
            const plainText = document.createElement("span");
            plainText.innerText = unescapeFormattedText(line.slice(current, match.index));
            if (plainText.innerText.length > 0)
                dest.appendChild(plainText);
        }

        const header = match.groups["header"];
        const url = match.groups["url"];
        const code3 = match.groups["code3"];
        const code = match.groups["code"];
        const bold = match.groups["bold"];
        const italic = match.groups["italic"];
        const under = match.groups["under"];
        const strike = match.groups["strike"];
        const spoiler = match.groups["spoiler"];

        if (header !== undefined && !excluded.includes("header")) {
            current = match.index + header.length;
            const level = match.groups["headerlevel"];
            const text = match.groups["headertext"];
            const h = document.createElement(`h${level.length}`);
            if (isInput) {
                const pre = document.createElement("span");
                pre.classList.add("formatting-token");
                pre.innerText = level + " ";
                h.appendChild(pre);
                unescapeFormattedTextInput(text, h);
            } else h.innerText = unescapeFormattedText(isInput ? `${level} ${text}` : text);
            dest.appendChild(h);
        } else if (url !== undefined && !excluded.includes("url")) {
            current = match.index + url.length;
            const href = match.groups["urlhref"];
            const domain = match.groups["urldomain"];
            const name = match.groups["urlname"];
            if (isInput) {
                const aContainer = document.createElement("span");
                const preName = document.createElement("span");
                const between = document.createElement("span");
                const afterLink = document.createElement("span");
                const linkText = document.createElement("span");
                const nameText = document.createElement("span");
                aContainer.classList.add("a-preview");
                aContainer.setAttribute("href", href.startsWith(domain) ? `https://${href}` : a.href = href)
                preName.classList.add("formatting-token");
                between.classList.add("formatting-token");
                afterLink.classList.add("formatting-token");

                linkText.innerText = href;
                preName.innerText = "[";
                between.innerText = "](";
                afterLink.innerText = ")";
                if (name !== undefined && name.trim())
                    formatLine(name, nameText, [...excluded, "url"], isInput);
                else
                    nameText.innerText = "";
                
                aContainer.append(preName, nameText, between, linkText, afterLink);
                dest.appendChild(aContainer);
            } else {
                const a = document.createElement("a");
                a.href = href.startsWith(domain) ? `https://${href}` : a.href = href;
                if (name && name)
                    formatLine(name, a, [...excluded, "url"], isInput);
                else
                    a.innerText = a.href;
                dest.appendChild(a);
            }
        } else if (code !== undefined && !excluded.includes("code")) {
            current = match.index + code.length;
            const c = document.createElement("code");
            const text = match.groups["codetext"];
            c.classList.add("code");
            if (isInput) {
                const tokenPre = document.createElement("span");
                const tokenPost = document.createElement("span");
                tokenPre.classList.add("formatting-token");
                tokenPost.classList.add("formatting-token");
                tokenPre.innerText = tokenPost.innerText = "`";
                c.appendChild(tokenPre);
                unescapeFormattedTextInput(text, c);
                c.appendChild(tokenPost);
            } else c.innerText = unescapeFormattedText(text);
            dest.appendChild(c);
        } else if (code3 !== undefined && !excluded.includes("code")) {
            current = match.index + code3.length;
            const pre = document.createElement("pre");
            const c = document.createElement("code");
            const text = match.groups["code3text"];
            pre.classList.add("code");
            if (isInput) {
                const tokenPre = document.createElement("span");
                const tokenPost = document.createElement("span");
                tokenPre.classList.add("formatting-token");
                tokenPost.classList.add("formatting-token");
                tokenPre.innerText = tokenPost.innerText = "```";
                c.appendChild(tokenPre);
                unescapeFormattedTextInput(text, c);
                c.appendChild(tokenPost);
            } else c.innerText = unescapeFormattedText(text);
            pre.appendChild(c);
            dest.appendChild(pre);
        } else if (bold !== undefined && !excluded.includes("bold")) {
            current = match.index + bold.length;
            const b = document.createElement("b");
            const text = match.groups["boldtext"];
            if (isInput) {
                const tokenPre = document.createElement("span");
                const tokenPost = document.createElement("span");
                tokenPre.classList.add("formatting-token");
                tokenPost.classList.add("formatting-token");
                tokenPre.innerText = tokenPost.innerText = "**";
                b.appendChild(tokenPre);
                formatLine(text, b, [...excluded, "bold"], isInput);
                b.appendChild(tokenPost);
            } else formatLine(text, b, [...excluded, "bold"], isInput);
            dest.appendChild(b);
        } else if (italic !== undefined && !excluded.includes("italic")) {
            current = match.index + italic.length;
            const i = document.createElement("i");
            const text = match.groups["italictext"];
            if (isInput) {
                const tokenPre = document.createElement("span");
                const tokenPost = document.createElement("span");
                tokenPre.classList.add("formatting-token");
                tokenPost.classList.add("formatting-token");
                tokenPre.innerText = tokenPost.innerText = "*";
                i.appendChild(tokenPre);
                formatLine(text, i, [...excluded, "italic"], isInput);
                i.appendChild(tokenPost);
            } else formatLine(text, i, [...excluded, "italic"], isInput);
            dest.appendChild(i);
        } else if (under !== undefined && !excluded.includes("under")) {
            current = match.index + under.length;
            const u = document.createElement("u");
            const text = match.groups["undertext"];
            if (isInput) {
                const tokenPre = document.createElement("span");
                const tokenPost = document.createElement("span");
                tokenPre.classList.add("formatting-token");
                tokenPost.classList.add("formatting-token");
                tokenPre.innerText = tokenPost.innerText = "__";
                u.appendChild(tokenPre);
                formatLine(text, u, [...excluded, "under"], isInput);
                u.appendChild(tokenPost);
            } else formatLine(text, u, [...excluded, "under"], isInput);
            dest.appendChild(u);
        } else if (strike !== undefined && !excluded.includes("strike")) {
            current = match.index + strike.length;
            const s = document.createElement("s");
            const text = match.groups["striketext"];
            if (isInput) {
                const tokenPre = document.createElement("span");
                const tokenPost = document.createElement("span");
                tokenPre.classList.add("formatting-token");
                tokenPost.classList.add("formatting-token");
                tokenPre.innerText = tokenPost.innerText = "~~";
                s.appendChild(tokenPre);
                formatLine(text, s, [...excluded, "strike"], isInput);
                s.appendChild(tokenPost);
            } else formatLine(text, s, [...excluded, "strike"], isInput);
            dest.appendChild(s);
        } else if (spoiler !== undefined && !excluded.includes("spoiler")) {
            current = match.index + spoiler.length;
            const sp = document.createElement("span");
            const text = match.groups["spoilertext"];
            sp.classList.add("spoiler");
            sp.tabIndex = -1;
            if (isInput) {
                sp.classList.add("view");
                const tokenPre = document.createElement("span");
                const tokenPost = document.createElement("span");
                tokenPre.classList.add("formatting-token");
                tokenPost.classList.add("formatting-token");
                tokenPre.innerText = tokenPost.innerText = "||";
                sp.appendChild(tokenPre);
                formatLine(text, sp, [...excluded, "spoiler"], isInput);
                sp.appendChild(tokenPost);
            } else formatLine(text, sp, [...excluded, "spoiler", isInput]);
            dest.appendChild(sp);
        } else if (excluded.length < 1) {
            throw new Error("unknown match");
        }
    }

    if (isInput)
        unescapeFormattedTextInput(line.slice(current), dest);
    else {
        const lastPlainText = document.createElement("span");
        lastPlainText.innerText = unescapeFormattedText(line.slice(current));
        if (lastPlainText.innerText.length > 0)
            dest.appendChild(lastPlainText);
    }
}

/**
 * @typedef BulletHierarchyNode
 * @property {BulletHierarchyNode?} parent
 * @property {HTMLUListElement} elm
 */

/**
 * @param {string} text
 * @param {HTMLElement} dest
 * @param {string[]} excluded
 * @param {boolean|undefined} isInput
 */
function formatText(text, dest, excluded, isInput) {
    let current = 0;
    for (const match of text.matchAll(REGEX_LINES_FORMAT_ALL)) {
        const lines = text.slice(current, match.index).split("\n");
        for (const line of lines) {
            const tline = line.trim();
            if (tline.length > 0) {
                const p = document.createElement("p");
                formatLine(tline, p, excluded, isInput);
                dest.appendChild(p);
            }
        }

        let codeblock = match.groups["codeblock"];
        let bullets = match.groups["bullets"];
        if (codeblock !== undefined && !excluded.includes("codeblock")) {
            //if (codeblock === text.slice(match.index, codeblock.length))
            current = match.index + codeblock.length;
            const pre = document.createElement("pre");
            const c = document.createElement("code");
            pre.classList.add("code");
            if (isInput) {
                const pre = document.createElement("span");
                const post = document.createElement("span");
                pre.classList.add("formatting-token");
                post.classList.add("formatting-token");
                pre.innerText = post.innerText = "```";
                c.appendChild(pre);
                unescapeFormattedTextInput(`${match.groups["codeblocklang"] || ""}\n${match.groups["codeblocktext"]}`, c);
                c.appendChild(post);
            } else c.innerText = unescapeFormattedText(match.groups["codeblocktext"]);
            const lang = (match.groups["codeblocklang"] || "").trim();
            if (lang.length > 0)
                c.setAttribute("language", lang);
            pre.appendChild(c);
            dest.appendChild(pre);
        } else if (bullets !== undefined && !excluded.includes("bullets")) {
            current = match.index + bullets.length;
            const rows = bullets.split("\n");

            if (isInput) {
                for (const row of rows) {
                    const rowElm = document.createElement("p");
                    let bulletIndex;
                    for (let i = 0; i < row.length; i++) {
                        const c = row[i];
                        if (c !== " " && c !== "\t") {
                            bulletIndex = i;
                            break;
                        }
                    }

                    const afterBullet = row[bulletIndex] === "-" ? bulletIndex + 1 : row.indexOf(".", bulletIndex)+1;
                    const indent = document.createElement("span");
                    indent.innerHTML = row.slice(0, bulletIndex).replaceAll(" ", "&#32;").replaceAll("\t", "&#9;");
                    const pre = document.createElement("span");
                    pre.innerText = row.slice(bulletIndex, afterBullet);

                    rowElm.appendChild(indent);
                    rowElm.appendChild(pre);
                    formatLine(row.slice(afterBullet), rowElm, [...excluded, "bullets"], isInput);
                    dest.appendChild(rowElm);
                }
                continue;
            }


            /** @type {BulletHierarchyNode} */
            let hierarchy = {
                parent: null,
                elm: document.createElement(rows[0].trimStart()[0] === "-" ? "ul" : "ol")
            };
            let indent = 0;
            for (let i = 0; i < rows[0].length; i++) {
                const c = rows[0][i];
                if (c === " " || c === "\t")
                    indent++;
                else
                    break;
            }

            for (const row of rows) {
                const unordered = row.trimStart()[0] === "-";
                const item = document.createElement("li");

                let newIndent = 0;
                for (let i = 0; i < row.length; i++) {
                    const c = row[i];
                    if (c === " " || c === "\t")
                        newIndent++;
                    else
                        break;
                }

                const delta = Math.trunc((newIndent - indent) / 2);
                indent = newIndent;
                if (delta < 0) {
                    for (let i = 0; i > delta && hierarchy.parent !== null; i--)
                        hierarchy = hierarchy.parent;
                } else if (delta > 0) {
                    for (let i = 0; i < delta; i++) {
                        const newElm = document.createElement(unordered ? "ul" : "ol");
                        hierarchy.elm.appendChild(newElm);
                        hierarchy = {
                            parent: hierarchy,
                            elm: newElm
                        };
                    }
                }

                formatLine(row.slice(row.indexOf(unordered ? "-" : ".")+1).trim(), item, [...excluded, "bullets"], isInput);
                hierarchy.elm.appendChild(item);
            }

            while (hierarchy.parent !== null)
                hierarchy = hierarchy.parent;

            dest.appendChild(hierarchy.elm);
        } else if (excluded.length < 1) {
            throw new Error("unknown match");
        }
    }

    const lastLines = text.slice(current).split("\n");
    for (const line of lastLines) {
        const tline = line.trim();
        if (tline.length > 0) {
            const p = document.createElement("p");
            dest.appendChild(p);
            formatLine(tline, p, excluded, isInput);
        }
    }
}

/**
 * @param {string} text
 * @returns {string}
 */
function prepFormattingText(text) {
    return text.replaceAll(/\\[&\*_~\\\[\]\(\)`\|]|&/g, m => {
        if (m[0] === "&") {
            return "&#038;";
        }
        m = m.slice(1);
        switch (m) {
        case "&":
            return "&#38;";
        case "[":
            return "&#91;";
        case "]":
            return "&#93;";
        case "(":
            return "&#40;";
        case ")":
            return "&#41;";
        case "*":
            return "&#42;";
        case "_":
            return "&#95;";
        case "`":
            return "&#96;";
        case "|":
            return "&#124;";
        case "~":
            return "&#126;";
        case "\\":
            return "&#92;";
        default:
            return m;
        }
    });
}

/**
 * @param {string} text
 * @returns {string}
 */
function unescapeFormattedText(text) {
    return text.replaceAll(/&#[0-9]+?;/g, m => {
        const doc = new DOMParser().parseFromString(m, "text/html");
        return doc.documentElement.textContent;
    });
}

/**
 * @param {string} text
 * @param {HTMLElement} dest
 */
function unescapeFormattedTextInput(text, dest) {
    let current = 0;
    for (const match of text.matchAll(/\x00(?:\x00|\x01|\x02)|&#[0-9]+?;/g)) {
        
        const plainText = document.createElement("span");
        plainText.innerText = text.slice(current, match.index);
        if (plainText.innerText.length > 0)
            dest.appendChild(plainText);

        const m = match[0];
        current = match.index + m.length;

        if (m[0] === "\0") {
            const cursor = document.createElement("span");
            switch (m[1]) {
            case "\0": {
                cursor.classList.add("cursor");
                break;
            }
            case "\x01": {
                cursor.classList.add("cursor-start");
                break;
            }
            case "\x02": {
                cursor.classList.add("cursor-end");
                break;
            }
            default:
                continue;
            }
            dest.appendChild(cursor);
            continue;
        }

        const doc = new DOMParser().parseFromString(m, "text/html");

        const backslashToken = document.createElement("span");
        const restored = document.createElement("span");
        backslashToken.classList.add("formatting-token");
        backslashToken.innerText = "\\";
        restored.innerText = doc.documentElement.textContent;

        if (restored.innerText == "&") {
            if (m.indexOf("0") < 0)
                dest.appendChild(backslashToken);
        } else if (prepFormattingText("\\"+restored.innerText) !== restored.innerText)
            dest.appendChild(backslashToken);
        dest.appendChild(restored);
    }

    const lastPlainText = document.createElement("span");
    lastPlainText.innerText = text.slice(current);
    if (lastPlainText.innerText.length > 0)
        dest.appendChild(lastPlainText);
}

class FormattingTextArea {
    /**
     * @param {HTMLTextAreaElement} inner
     * @param {HTMLElement} outer
     * @param {string[]} excluded
     */
    constructor(inner, outer, excluded) {
        /** @type {HTMLTextAreaElement} */
        this.inner = inner;
        /** @type {HTMLElement} */
        this.outer = outer;
        /** @type {string[]} */
        this.excluded = excluded || [];
        /** @type {number[]} */
        this.lines = [];
        /** @type {boolean} */
        this.linesUpToDate = false;
        /** @type {number} */
        this.selectionDirection = 0;

        applyFormattingTextAreaEvents(this);
    }

    countLines() {
        if (this.linesUpToDate)
            return;

        const lines = this.inner.value.split("\n");
        let index = 0;
        for (const line of lines) {
            this.lines.push(index);
            index += line.length + 1; //+1 to include the \n removed by split
        }
        this.linesUpToDate = true;
    }

    /**
     * @param {number} cursor 
     * @returns {{lineNumber: number, index: number, column: number}?}
     */
    getLineInfo(cursor) {
        if (this.lines.length < 1)
            return null;

        let lineStart = 0;
        let i = -1;
        for (const newLineStart of this.lines) {
            if (cursor === newLineStart)
                return {lineNumber: i+1, index: newLineStart, column: 0};
            else if (cursor > newLineStart) {
                lineStart = newLineStart;
                i++;
            } else break;
        }

        return {
            lineNumber: i,
            index: lineStart,
            column: cursor - lineStart
        };
    }

    redraw() {
        while (this.outer.children.length > 0)
            this.outer.firstChild.remove();

        let displayText;
        if (this.selectionDirection > 0) {
            displayText = this.inner.value.substring(0, this.inner.selectionStart) + SELECTION_START_CHARACTER
                + this.inner.value.substring(this.inner.selectionStart, this.inner.selectionEnd) + SELECTION_END_CHARACTER + CURSOR_CHARACTER
                + this.inner.value.substring(this.inner.selectionEnd);
        } else if (this.selectionDirection < 0) {
            displayText = this.inner.value.substring(0, this.inner.selectionStart) + SELECTION_START_CHARACTER + CURSOR_CHARACTER
                + this.inner.value.substring(this.inner.selectionStart, this.inner.selectionEnd) + SELECTION_END_CHARACTER
                + this.inner.value.substring(this.inner.selectionEnd);
        } else
            displayText = this.inner.value.substring(0, this.inner.selectionStart) + CURSOR_CHARACTER + this.inner.value.substring(this.inner.selectionStart);


        formatText(prepFormattingText(displayText), this.outer, this.excluded, true);

        this.outer.querySelectorAll(":scope .a-preview").forEach(/** @param {HTMLSpanElement} elm */elm => {
            elm.title = "Ctrl + Click to Navigate";
            elm.addEventListener("click", ev => {
                const href = elm.getAttribute("href");
                if (href && ev.ctrlKey)
                    window.open(href, "_blank");
            });
        });
    }
};

/**
 * @param {FormattingTextArea} area
 */
function applyFormattingTextAreaEvents(area) {
    /** @param {string} c */
    const insertCharacter = c => {
        if (area.inner.selectionStart || area.inner.selectionStart == 0) {
            const start = area.inner.selectionStart;
            const end = area.inner.selectionEnd;
            area.inner.value = area.inner.value.substring(0, start) + c + area.inner.value.substring(end);
            area.inner.selectionStart = area.inner.selectionEnd = end + Number(start == end);
        } else {
            area.inner.value += ev.key;
        }
        area.linesUpToDate = false;
        area.redraw();
    };

    /**
     * @param {number} pos
     * @param {KeyboardEvent} ev
     */
    const moveSelectionStart = (pos, ev) => {
        area.inner.selectionStart = pos;
        if (!ev.shiftKey || area.inner.selectionEnd == pos) {
            area.inner.selectionEnd = pos;
            area.selectionDirection = 0;
            return;
        } else if (area.inner.selectionEnd < pos) {
            area.inner.selectionStart = area.inner.selectionEnd;
            area.inner.selectionEnd = pos;
        }
        if (area.selectionDirection == 0)
            area.selectionDirection = -1;
    };
    /**
     * @param {number} pos
     * @param {KeyboardEvent} ev
     */
    const moveSelectionEnd = (pos, ev) => {
        area.inner.selectionEnd = pos;
        if (!ev.shiftKey || area.inner.selectionStart == pos) {
            area.inner.selectionStart = pos;
            area.selectionDirection = 0;
            return;
        } else if (area.inner.selectionStart > pos) {
            area.inner.selectionEnd = area.inner.selectionStart;
            area.inner.selectionStart = pos;
            area.selectionDirection *= -1;
        }
        if (area.selectionDirection == 0)
            area.selectionDirection = 1;
    };

    area.outer.addEventListener("keydown", ev => {
        switch (ev.key) {
        case "Backspace": {
            ev.preventDefault();
            if (area.inner.selectionStart || area.inner.selectionStart == 0) {
                const start = area.inner.selectionStart;
                const end = area.inner.selectionEnd;
                if (start == end) {
                    area.inner.value = area.inner.value.substring(0, start-1) + area.inner.value.substring(end);
                    area.inner.selectionStart = area.inner.selectionEnd = start-1;
                }
                else {
                    area.inner.value = area.inner.value.substring(0, start) + area.inner.value.substring(end);
                    area.inner.selectionStart = area.inner.selectionEnd = start;
                }
            } else {
                area.inner.value = area.inner.value.substring(0, area.inner.value.length - 1);
            }
            area.selectionDirection = 0;
            area.linesUpToDate = false;
            area.redraw();
            break;
        }
        case "Delete": {
            ev.preventDefault();
            if (area.inner.selectionStart || area.inner.selectionStart == 0) {
                const start = area.inner.selectionStart;
                const end = area.inner.selectionEnd;
                area.inner.value = area.inner.value.substring(0, start) + area.inner.value.substring(end+Number(start == end));
                area.inner.selectionStart = area.inner.selectionEnd = start;
            }
            area.selectionDirection = 0;
            area.linesUpToDate = false;
            area.redraw();
            break;
        }
        case "Escape": {
            area.outer.blur();
            break;
        }
        case "PageUp": {
            break;
        }
        case "PageDown": {
            break;
        }
        case "End": {
            ev.preventDefault();
            const moveFunc = area.selectionDirection < 0 ? moveSelectionStart : moveSelectionEnd;
            const selectionLead = area.selectionDirection < 0 ? area.inner.selectionStart : area.inner.selectionEnd;
            if (ev.ctrlKey) {
                moveFunc(area.inner.value.length, ev);
            } else {
                area.countLines();
                const lineInfo = area.getLineInfo(selectionLead);
                if (lineInfo == null || lineInfo.lineNumber >= area.lines.length-1)
                    moveFunc(area.inner.value.length, ev);
                else
                    moveFunc(area.lines[lineInfo.lineNumber+1] - 1, ev);
            }
            area.redraw();
            break;
        }
        case "Home": {
            ev.preventDefault();
            const moveFunc = area.selectionDirection > 0 ? moveSelectionEnd : moveSelectionStart;
            const selectionLead = area.selectionDirection > 0 ? area.inner.selectionEnd : area.inner.selectionStart;
            if (ev.ctrlKey) {
                moveFunc(0, ev);
            } else {
                area.countLines();
                const lineInfo = area.getLineInfo(selectionLead);
                const lineStart = lineInfo == null ? 0 : lineInfo.index;
                moveFunc(lineStart, ev);
            }
            area.redraw();
            break;
        }
        case "ArrowLeft": {
            ev.preventDefault();
            if (!ev.shiftKey && area.inner.selectionStart != area.inner.selectionEnd) {
                area.inner.selectionEnd = area.inner.selectionStart;
                area.selectionDirection = 0;
            } else {
                const moveFunc = area.selectionDirection > 0 ? moveSelectionEnd : moveSelectionStart;
                const selectionLead = area.selectionDirection > 0 ? area.inner.selectionEnd : area.inner.selectionStart;
                moveFunc(Math.max(selectionLead-1, 0), ev);
            }
            area.redraw();
            break;
        }
        case "ArrowUp": {
            ev.preventDefault();
            if (ev.ctrlKey) {
                //scroll
            } else {
                area.countLines();
                const moveFunc = area.selectionDirection > 0 ? moveSelectionEnd : moveSelectionStart;
                const selectionLead = area.selectionDirection > 0 ? area.inner.selectionEnd : area.inner.selectionStart;
                const currentLineInfo = area.getLineInfo(selectionLead);
                if (currentLineInfo === null || currentLineInfo.lineNumber-1 < 0) {
                    moveFunc(0, ev);
                } else {
                    const prevLineStart = area.lines[currentLineInfo.lineNumber-1];
                    const prevLineLength = currentLineInfo.index - prevLineStart - 1; // -1 to exclude the newline
                    moveFunc(prevLineStart + Math.min(currentLineInfo.column, prevLineLength), ev);
                }
            }
            area.redraw();
            break;
        }
        case "ArrowRight": {
            ev.preventDefault();
            if (!ev.shiftKey && area.inner.selectionStart !== area.inner.selectionEnd)
                area.inner.selectionStart = area.inner.selectionEnd;
            else {
                const moveFunc = area.selectionDirection < 0 ? moveSelectionStart : moveSelectionEnd;
                const selectionLead = area.selectionDirection < 0 ? area.inner.selectionStart : area.inner.selectionEnd;
                moveFunc(Math.min(selectionLead+1, area.inner.value.length), ev);
            }
            area.redraw();
            break;
        }
        case "ArrowDown": {
            ev.preventDefault();
            if (ev.ctrlKey) {
                //scroll
            } else {
                area.countLines();
                const moveFunc = area.selectionDirection < 0 ? moveSelectionStart : moveSelectionEnd;
                const selectionLead = area.selectionDirection ? 0 > area.inner.selectionStart : area.inner.selectionEnd;
                const currentLineInfo = area.getLineInfo(selectionLead);
                if (currentLineInfo === null || currentLineInfo.lineNumber+1 >= area.lines.length)
                    moveFunc(area.inner.value.length, ev);
                else {
                    const nextLineStart = area.lines[currentLineInfo.lineNumber+1];
                    const nextLineLength = nextLineStart - currentLineInfo.index - 1;
                    moveFunc(nextLineStart + Math.min(currentLineInfo.column, nextLineLength), ev);
                }
            }
            area.redraw();
            break;
        }
        case "Tab":
            ev.preventDefault();
            insertCharacter("\t");
            break;
        case "Enter":
            ev.preventDefault();
            insertCharacter("\n");
            break;
        default: {
            if (ev.key.length > 1)
                break;
            else if (ev.ctrlKey) {
                switch (ev.key) {
                case "a":
                    ev.preventDefault();
                    area.inner.selectionStart = 0;
                    area.inner.selectionEnd = area.inner.value.length;
                    area.redraw();
                    break;
                case "x":
                case "c": {
                    ev.preventDefault();
                    const start = area.inner.selectionStart;
                    const end = area.inner.selectionEnd;
                    if (start != end) {
                        const selection = area.inner.value.substring(start, end + 1);
                        if (selection.length > 0)
                            navigator.clipboard.writeText(selection);
                        if (ev.key === "x") {
                            area.inner.value = area.inner.value.substring(0, start) + area.inner.value.substring(end);
                            area.inner.selectionStart = area.inner.selectionEnd = start;
                            area.linesUpToDate = false;
                        }
                    }
                    area.redraw();
                    break;
                }
                case "v":
                    ev.preventDefault();
                    navigator.clipboard.readText().then(text => {
                        insertCharacter(text);
                    });
                    break;
                }
                break;
            }

            ev.preventDefault();
            insertCharacter(ev.key);
            break;
        }
        }
    });
}