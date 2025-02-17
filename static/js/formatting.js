const CURSOR_CHARACTER = "\0\0";
const SELECTION_START_CHARACTER = "\0\x01";
const SELECTION_END_CHARACTER = "\0\x02";

const REGEX_LINE_FORMAT_ALL =
/(?<header>^(?<headerlevel>[#]{1,6})\x20(?<headertext>.+))|(?<url>(\[(?<urlhref>(?:https:\/\/)?(?<urldomain>[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b)(?<urlpath>[-a-zA-Z0-9()@:%_\+.~#?&\/=]*))\](?:\((?<urlname>.*)\))?))|(?<code3>[`]{3}(?<code3text>.+?)(?=[`]{3}(?:[^\n`]|$))[`]{3})|(?<code>`(?<codetext>.+?)(?=`(?:[^\n`]|$))`)|(?<bold>[*]{2}(?<boldtext>.+?)(?=[*]{2}(?:[^\n*]|$))[*]{2})|(?<italic>\*(?<italictext>.+?)(?=\*(?:[^\n*]|$))\*)|(?<under>[_]{2}(?<undertext>.+?)[_]{2})|(?<strike>[~]{2}(?<striketext>.+?)[~]{2})|(?<spoiler>[\|]{2}(?<spoilertext>.+?)[\|]{2})/g;

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
                const preLink = document.createElement("span");
                const between = document.createElement("span");
                const afterName = document.createElement("span");
                const linkText = document.createElement("span");
                const nameText = document.createElement("span");
                aContainer.classList.add("a-preview");
                aContainer.setAttribute("href", href.startsWith(domain) ? `https://${href}` : a.href = href)
                preLink.classList.add("formatting-token");
                between.classList.add("formatting-token");
                afterName.classList.add("formatting-token");

                linkText.innerText = href;
                preLink.innerText = "[";
                
                if (name === undefined) {
                    between.innerText = "]";
                    aContainer.append(preLink, linkText, between);
                } else {
                    between.innerText = "](";
                    afterName.innerText = ")";
                    if (name.trim())
                        formatLine(name, nameText, [...excluded, "url"], isInput);
                    else
                        nameText.innerText = "";
    
                    aContainer.append(preLink, linkText, between, nameText, afterName);
                }

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
    let cursorPlaces = {};
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

        applyFormattingTextAreaEvents(this);
    }

    redraw() {
        while (this.outer.children.length > 0)
            this.outer.firstChild.remove();

        let displayText;
        if (this.inner.selectionStart == this.inner.selectionEnd)
            displayText = this.inner.value.substring(0, this.inner.selectionStart) + CURSOR_CHARACTER + this.inner.value.substring(this.inner.selectionStart);
        else if (this.inner.selectionDirection === "backward") {
            displayText = this.inner.value.substring(0, this.inner.selectionStart) + SELECTION_START_CHARACTER
                + this.inner.value.substring(this.inner.selectionStart, this.inner.selectionEnd) + SELECTION_END_CHARACTER + CURSOR_CHARACTER
                + this.inner.value.substring(this.inner.selectionEnd);
        } else {
            displayText = this.inner.value.substring(0, this.inner.selectionStart) + SELECTION_START_CHARACTER + CURSOR_CHARACTER
                + this.inner.value.substring(this.inner.selectionStart, this.inner.selectionEnd) + SELECTION_END_CHARACTER
                + this.inner.value.substring(this.inner.selectionEnd);
        }

        formatText(prepFormattingText(displayText), this.outer, this.excluded, true);

        //TODO re-apply event listeners for `outer` children
    }
};

/**
 * @param {FormattingTextArea} area
 */
function applyFormattingTextAreaEvents(area) {
    const insertCharacter = c => {
        if (area.inner.selectionStart || area.inner.selectionStart == 0) {
            const start = area.inner.selectionStart;
            const end = area.inner.selectionEnd;
            area.inner.value = area.inner.value.substring(0, start) + c + area.inner.value.substring(end);
            area.inner.selectionStart = area.inner.selectionEnd = end + Number(start == end);
        } else {
            area.inner.value += ev.key;
        }
        area.redraw();
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
                area.redraw();
            }
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
            if (ev.ctrlKey) {
                area.inner.selectionEnd = area.inner.value.length;
                if (!ev.shiftKey)
                    area.inner.selectionStart = area.inner.selectionEnd;
            } else {
                let lineEnd = area.inner.value.indexOf("\n", area.inner.selectionEnd);
                if (lineEnd < 0)
                    lineEnd = area.inner.value.length;
                area.inner.selectionEnd = lineEnd;
                if (!ev.shiftKey)
                    area.inner.selectionStart = lineEnd;
            }
            break;
        }
        case "Home": {
            ev.preventDefault();
            if (ev.ctrlKey) {
                area.inner.selectionStart = 0;
                if (!ev.shiftKey)
                    area.inner.selectionEnd = 0;
            } else {
                const lineStart = area.inner.value.slice(0, area.inner.selectionStart).lastIndexOf("\n")+1;
                area.inner.selectionStart = lineStart;
                if (!ev.shiftKey)
                    area.inner.selectionEnd = lineStart;
            }
            break;
        }
        case "ArrowLeft": {
            ev.preventDefault();
            if (!ev.shiftKey && area.inner.selectionStart != area.inner.selectionEnd)
                area.inner.selectionEnd = area.inner.selectionStart;
            else {
                area.inner.selectionStart = Math.max(area.inner.selectionStart-1, 0);
                if (!ev.shiftKey)
                    area.inner.selectionEnd = area.inner.selectionStart;
            }
            area.redraw();
            break;
        }
        case "ArrowUp": {
            ev.preventDefault();
            if (ev.ctrlKey) {
                //scroll
            } else {
                const lineStart = area.inner.value.slice(0, area.inner.selectionStart).lastIndexOf("\n")+1;
                if (lineStart == 0) {
                    area.inner.selectionStart = 0;
                    if (!ev.shiftKey)
                        area.inner.selectionEnd = 0;
                } else {
                    const column = area.inner.selectionStart - lineStart;
                    const nextLineStart = area.inner.value.slice(0, lineStart-1).lastIndexOf("\n")+1;
                    const nextLineLength = area.inner.value.indexOf("\n", nextLineStart) - nextLineStart;

                    area.inner.selectionStart = nextLineStart + Math.min(column, nextLineLength);
                    if (!ev.shiftKey)
                        area.inner.selectionEnd = area.inner.selectionStart;
                }
            }
            break;
        }
        case "ArrowRight": {
            ev.preventDefault();
            if (!ev.shiftKey && area.inner.selectionStart !== area.inner.selectionEnd)
                area.inner.selectionStart = area.inner.selectionEnd;
            else {
                area.inner.selectionEnd = Math.min(area.inner.selectionEnd+1, area.inner.value.length);
                if (!ev.shiftKey)
                    area.inner.selectionStart = area.inner.selectionEnd;
            }
            break;
        }
        case "ArrowDown": {
            ev.preventDefault();
            if (ev.ctrlKey) {
                //scroll
            } else if (area.inner.selectionEnd < area.inner.value.length) {
                const lineStart = area.inner.value.slice(0, area.inner.selectionStart).lastIndexOf("\n")+1;
                const column = area.inner.selectionStart - lineStart;
                const nextLineStart = area.inner.value.indexOf("\n", lineStart)+1;
                if (nextLineStart < lineStart)
                    area.inner.selectionEnd = area.inner.value.length;
                else {
                    const nextLineEnd =  area.inner.value.indexOf("\n", nextLineStart);
                    const nextLineLength = (nextLineEnd < 0 ? area.inner.value.length : nextLineEnd) - nextLineStart;
                    area.inner.selectionEnd = nextLineStart + Math.min(column, nextLineLength);
                }
                if (!ev.shiftKey)
                    area.inner.selectionStart = area.inner.selectionEnd;
            }
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
                return;

            ev.preventDefault();
            insertCharacter(ev.key);
            break;
        }
        }
        area.redraw();
    });
}