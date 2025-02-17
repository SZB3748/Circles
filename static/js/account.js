
function formatBio() {
    const accountBio = document.getElementById("account-bio");
    const raw = accountBio.getAttribute("raw");
    while (accountBio.children.length > 0)
        accountBio.firstChild.remove();
    formatText(prepFormattingText(raw), accountBio, ["header"]);
}

window.addEventListener("load", () => {
    const accountInfo = document.getElementById("account-info");
    const accountInfoParent = document.getElementById("account-info-parent");
    const updateSize = setupCircleResize(accountInfo);
    updateSize();
    accountInfoParent.classList.remove("hidden");

    const accountBio = document.getElementById("account-bio");
    formatBio(accountBio.getAttribute("raw"));

    const logoutButton = document.getElementById("logout-button");
    logoutButton.addEventListener("click", async () => {
        const r = await fetch("/logout", {
            method: "POST"
        });
        if (r.ok)
            location.reload();
        else {
            const text = await r.text();
            addTopToast(`Failed to logout (${r.status}): ${text}`, 6000);
        }
    });
});