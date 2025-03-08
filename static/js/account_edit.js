
let editing = false;
let editFile = null;

/**
 * @param {string} src
 * @param {() => boolean|undefined} success
 * @param {() => boolean|undefined} failure
 */
function changeIconDialogue(src, success, failure) {
    const container = document.getElementById("edit-icon-preview-container");
    const iconPreview = document.getElementById("changed-account-icon");
    const buttonConfirm = document.getElementById("changed-account-confirm");
    const buttonCancel = document.getElementById("changed-account-cancel");

    container.classList.remove("hidden");

    iconPreview.src = src;

    const closeInstance = () => {
        buttonConfirm.removeEventListener("click", confirmClick);
        buttonCancel.removeEventListener("click", cancelClick);
        container.classList.add("hidden");
    };

    const containerClick = () => {
        buttonCancel.click();
    };
    const confirmClick = () => {
        if (success == undefined || success() != false)
            closeInstance();
    };
    const cancelClick = () => {
        if (failure == undefined || failure() != false)
            closeInstance();
    };

    container.addEventListener("click", containerClick, {once: true});
    buttonConfirm.addEventListener("click", confirmClick);
    buttonCancel.addEventListener("click", cancelClick);
}

function confirmReload(ev) {
    const nameEdit = document.getElementById("account-name-edit");
    /** @type {HTMLImageElement} */
    const accountIcon = document.getElementById("account-icon");
    const accountBio = document.getElementById("account-bio");
    /** @type {HTMLTextAreaElement} */
    const bioEdit = document.getElementById("account-bio-edit");
    const iconEdit = document.getElementById("edit-icon");
    if (nameEdit.value !== nameEdit.getAttribute("original")
        || bioEdit.value !== accountBio.getAttribute("raw")
        || accountIcon.src !== iconEdit.getAttribute("original")
        || document.querySelector("#edit-icon-preview-container:not(.hidden)") != null)
        ev.preventDefault();
}

function enterEditMode() {
    editing = true;
    const accountName = document.getElementById("account-name");
    const iconContainer = document.getElementById("icon-container");
    /** @type {HTMLImageElement} */
    const accountIcon = document.getElementById("account-icon");
    const iconEdit = document.createElement("div");
    const accountBio = document.getElementById("account-bio");
    const editButton = document.getElementById("edit-button");
    const logoutButton = document.getElementById("logout-button");
    const saveButton = document.createElement("button");

    editButton.innerText = "Cancel";
    logoutButton.style.display = "none";
    saveButton.id = "save-button";
    saveButton.innerText = "Save";
    saveButton.addEventListener("click", saveEdits);
    editButton.parentElement.appendChild(saveButton);

    const nameEdit = document.createElement("input");
    nameEdit.id = "account-name-edit";
    if (accountName.hasAttribute("no-display-name"))
        nameEdit.setAttribute("original", "");
    else {
        nameEdit.value = accountName.innerText;
        nameEdit.setAttribute("original", accountName.innerText);
    }
    nameEdit.placeholder = "Display Name";
    
    accountName.innerHTML = "";
    accountName.appendChild(nameEdit);

    const bioEdit = document.createElement("textarea");
    bioEdit.id = "account-bio-edit";
    const bioRaw = accountBio.getAttribute("raw");
    bioEdit.value = bioRaw;
    while (accountBio.children.length > 0)
        accountBio.firstChild.remove();
    accountBio.appendChild(bioEdit);

    iconEdit.id = "edit-icon";
    iconEdit.innerText = "Click to Edit";
    iconEdit.setAttribute("original", accountIcon.src);
    iconEdit.addEventListener("click", () => {
        const fileGrab = document.createElement("input");
        fileGrab.type = "file";
        fileGrab.accept = "image/*";
        fileGrab.multiple = false;
        /** @type {string?} */
        let lastURL = null;
        fileGrab.addEventListener("change", () => {
            if (fileGrab.files.length < 1)
                return;
            const newURL = URL.createObjectURL(fileGrab.files[0]);
            changeIconDialogue(newURL,
                () => {
                    if (lastURL != null)
                        URL.revokeObjectURL(lastURL);
                    accountIcon.src = lastURL = newURL;
                    editFile = fileGrab.files[0];
                },
                () => {
                    URL.revokeObjectURL(newURL);
                }
            );
        });
        fileGrab.click();
    });
    iconContainer.appendChild(iconEdit);

    window.addEventListener("beforeunload", confirmReload);
}

function exitEditMode() {
    editing = false;
    const accountName = document.getElementById("account-name");
    const nameEdit = document.getElementById("account-name-edit");
    /** @type {HTMLImageElement} */
    const accountIcon = document.getElementById("account-icon");
    const iconEdit = document.getElementById("edit-icon");
    const editButton = document.getElementById("edit-button");
    const logoutButton = document.getElementById("logout-button");
    const saveButton = document.getElementById("save-button");

    editButton.innerText = "Edit";
    logoutButton.style.display = "";
    saveButton.remove();

    nameEdit.remove();
    accountName.innerText = accountName.hasAttribute("no-display-name") ? accountName.getAttribute("username") : nameEdit.getAttribute("original");

    formatBio();

    iconEdit.remove();
    accountIcon.src = iconEdit.getAttribute("original");

    window.removeEventListener("beforeunload", confirmReload);
}

async function saveEdits() {
    const accountName = document.getElementById("account-name");
    /** @type {HTMLInputElement} */
    const nameEdit = document.getElementById("account-name-edit");
    /** @type {HTMLImageElement} */
    const accountIcon = document.getElementById("account-icon");
    const iconEdit = document.getElementById("edit-icon");
    const accountBio = document.getElementById("account-bio");
    /** @type {HTMLTextAreaElement} */
    const bioEdit = document.getElementById("account-bio-edit");

    const data = new FormData();
    if (nameEdit.value !== nameEdit.getAttribute("original"))
        data.set("displayname", nameEdit.value);
    if (bioEdit.value !== accountBio.getAttribute("raw"))
        data.set("bio", bioEdit.value);
    if (accountIcon.src !== iconEdit.getAttribute("original"))
        data.set("pfp", editFile);

    if (data.entries().next().done) {
        location.hash = "";
        return;
    }

    const r = await fetch(`/@${accountName.getAttribute("username")}/edit`, {
        method: "POST",
        body: data
    });

    if (r.ok) {
        const newValues = await r.json();
        if (newValues.displayname !== undefined) {
            if (newValues.displayname == null) {
                accountName.setAttribute("no-display-name", "");
            } else {
                nameEdit.setAttribute("original", newValues.displayname);
                accountName.removeAttribute("no-display-name");
            }
        }
        if (newValues.bio !== undefined)
            accountBio.setAttribute("raw", newValues.bio);
        if (newValues.pfp !== undefined)
            iconEdit.setAttribute("original", `/media/${newValues.pfp}`);
        location.hash = "";

    } else {
        const text = await r.text();
        addTopToast(`Failed to update account info (${r.status}): ${text}`, 6000);
    }
}

window.addEventListener("load", () => {
    if (location.hash === "#edit")
        enterEditMode();
    const editButton = document.getElementById("edit-button");
    editButton.addEventListener("click", () => {
        if (location.hash === "#edit")
            location.hash = "";
        else
            location.hash = "edit";
    });
});

window.addEventListener("hashchange", () => {
    if (location.hash === "#edit") {
        if (!editing)
            enterEditMode();
    } else if (location.hash === "") {
        if (editing)
            exitEditMode();
    }
});