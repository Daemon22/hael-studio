(() => {
  const blocked = [
    "#load-example",
    "#empty-field",
    "#focus-create",
    "#action-create",
    "#action-connect",
    "#action-speak",
    "#action-realize",
    "#connect-mode",
    "#node-form",
    "#intent-form",
    "#relation-dialog",
    "#field-view [data-action]",
    "#field-view [data-empty]",
    "#inspector-content [data-action]",
    "#inspector-content #add-target",
    "#inspector-content #realize",
  ].join(",");

  function lockMutations() {
    document.querySelectorAll(blocked).forEach((element) => {
      if (element instanceof HTMLElement && !element.hidden) element.hidden = true;
    });
    document.querySelectorAll("#sidebar-tree [data-sidebar-node]").forEach((node) => {
      if (node instanceof HTMLElement && node.draggable) node.draggable = false;
    });
  }

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest(blocked) : null;
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  for (const eventName of ["dragstart", "dragover", "drop"]) {
    document.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  }

  const observer = new MutationObserver(lockMutations);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  lockMutations();
})();
