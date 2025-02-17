
/**
 * @param {HTMLElement} elm
 * @returns {() => void}
 */
function setupCircleResize(elm) {
    const updateSize = () => {
        const rect = elm.getBoundingClientRect();
        elm.style.margin = `${(Math.sqrt(rect.width ** 2 * 2) - rect.width) / 2}px`;
    }
    window.addEventListener("resize", updateSize);
    return updateSize;
}

/**
 * @param {HTMLElement|string} inner
 * @param {number} aliveMS
 * @returns {HTMLDivElement}
 */
function addTopToast(inner, aliveMS) {
    if (typeof inner === "string") {
        const newInner = document.createElement("span");
        newInner.innerText = inner;
        inner = newInner;
    } else if (inner == null) return;

    const parent = document.createElement("div");
    parent.classList.add("top-toast");
    parent.style.animation = "top-toast-enter 0.5s ease-out forwards";

    const hide = () => {
        parent.style.animation = "top-toast-exit 0.25s ease-in forwards";
        setTimeout(() => parent.remove(), 250);
    }

    const timeout = setTimeout(hide, aliveMS);
    parent.addEventListener("click", () => {
        hide();
        clearTimeout(timeout);
    }, {once: true});

    parent.appendChild(inner);
    document.body.appendChild(parent);

    return parent;
}

/**
 * @param {HTMLElement} elm
 */
function calculateFittingFontSize(elm) {
    elm.style.fontSize = "";
    const parentRect = elm.parentElement.getBoundingClientRect();
    const rect = elm.getBoundingClientRect();

    if (parentRect.width >= rect.width)
        return;

    const style = window.getComputedStyle(elm, null);
    const fontSize = parseFloat(style.fontSize); //px
    
    const newFontSize = fontSize * parentRect.width / rect.width;
    elm.style.fontSize = `${newFontSize}px`;
}

/**
 * @typedef CircumfixCounting
 * @property {string} char
 * @property {CircumfixCounting?} next
 */

const REGEX_LINE_FORMAT_ALL =
/(?<header>^(?<headerlevel>[#]{1,6})\x20(?<headertext>.+))|(?<url>(\[(?<urlhref>(?:https:\/\/)?(?<urldomain>[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b)(?<urlpath>[-a-zA-Z0-9()@:%_\+.~#?&\/=]*))\](?:\((?<urlname>.*)\))?))|(?<code3>[`]{3}(?<code3text>.+?)(?=[`]{3}(?:[^\n`]|$))[`]{3})|(?<code>`(?<codetext>.+?)(?=`(?:[^\n`]|$))`)|(?<bold>[*]{2}(?<boldtext>.+?)(?=[*]{2}(?:[^\n*]|$))[*]{2})|(?<italic>\*(?<italictext>.+?)(?=\*(?:[^\n*]|$))\*)|(?<under>[_]{2}(?<undertext>.+?)[_]{2})|(?<strike>[~]{2}(?<striketext>.+?)[~]{2})|(?<spoiler>[\|]{2}(?<spoilertext>.+?)[\|]{2})/g;

const REGEX_LINES_FORMAT_ALL = /(?<codeblock>[`]{3}(?<codeblocklang>.+?)?\n(?<codeblocktext>[\s\S]*?)(?=[`]{3}(?:[^\n`]|$))[`]{3})|(?<bullets>^[^\S\n]*(?:\-|[0-9]+\.).+(?:\n[^\S\n]*(?:\-|[0-9]+\.).+)*)/gm;


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

                preLink.innerText = "[";
                between.innerText = "](";
                afterName.innerText = ")";

                if (name.trim())
                    formatLine(name, nameText, [...excluded, "url"], isInput);
                else
                    nameText.innerText = name;
                linkText.innerText = href;

                aContainer.append(preLink, linkText, between, nameText, afterName);
                dest.appendChild(aContainer);
            } else {
                const a = document.createElement("a");
                a.href = href.startsWith(domain) ? `https://${href}` : a.href = href;
                if (name)
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

        const codeblock = match.groups["codeblock"];
        const bullets = match.groups["bullets"];
        if (codeblock !== undefined && !excluded.includes("codeblock")) {
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
    return text.replaceAll(/\\[\*_~\\\[\]\(\)`\|]|[\\]?&/g, m => {
        if (m[m.length-1] === "&")
            return "&#38;";
        m = m.slice(1);
        switch (m) {
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
    for (const match of text.matchAll(/&#[0-9]+?;/g)) {
        const plainText = document.createElement("span");
        plainText.innerText = text.slice(current, match.index);
        if (plainText.innerText.length > 0)
            dest.appendChild(plainText);

        const m = match[0];
        current = match.index + m.length;
        const doc = new DOMParser().parseFromString(m, "text/html");

        const backslashToken = document.createElement("span");
        const restored = document.createElement("span");
        backslashToken.classList.add("formatting-token");
        backslashToken.innerText = "\\";
        restored.innerText = doc.documentElement.textContent;

        if (prepFormattingText("\\"+restored.innerText) !== restored.innerText)
            dest.appendChild(backslashToken)
        dest.appendChild(restored);
    }

    const lastPlainText = document.createElement("span");
    lastPlainText.innerText = text.slice(current);
    if (lastPlainText.innerText.length > 0)
        dest.appendChild(lastPlainText);
}

window.addEventListener("load", () => {
    document.querySelectorAll(".resize-font").forEach(elm => {
        window.addEventListener("resize", () => setTimeout(() => calculateFittingFontSize(elm), 0));
        calculateFittingFontSize(elm);
    });
});