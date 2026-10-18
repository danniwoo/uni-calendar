// No scheduled work, storage, or external messaging. Clicking the action grants
// temporary activeTab access; the preview still requires an explicit Read click.
chrome.action.onClicked.addListener((tab) => {
  const url = new URL(chrome.runtime.getURL("preview.html"));
  try {
    if (Number.isInteger(tab.id) && new URL(tab.url).origin === "https://canvas.sydney.edu.au") {
      url.searchParams.set("tab", String(tab.id));
    }
  } catch { /* Open the instructions when invoked outside Canvas. */ }
  chrome.tabs.create({ url: url.href });
});
