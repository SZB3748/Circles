
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


window.addEventListener("load", () => {
    document.querySelectorAll(".resize-font").forEach(elm => {
        window.addEventListener("resize", () => setTimeout(() => calculateFittingFontSize(elm), 0));
        calculateFittingFontSize(elm);
    });
});