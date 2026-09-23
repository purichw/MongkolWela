const library = document.querySelector('[data-tarot-library]');
if (library) {
  const select = library.querySelector('#tarot-category');
  const search = library.querySelector('#tarot-card-search');
  const categories = [...library.querySelectorAll('[data-meaning-category]')];
  const groups = [...library.querySelectorAll('[data-meaning-group]')];
  const cards = [...library.querySelectorAll('[data-meaning-search]')];
  const expand = library.querySelector('[data-library-expand]');
  const normalize = value => value.normalize('NFKC').toLocaleLowerCase('th').trim();
  const searchable = new Map(cards.map(card => [card, normalize(card.dataset.meaningSearch)]));
  const validGroup = value => groups.some(group => group.id === value) ? value : 'all';
  let activeGroup = 'all';

  function updateExpand() {
    const visible = groups.filter(group => !group.hidden);
    const allOpen = visible.length > 0 && visible.every(group => group.open);
    expand.querySelector('span').textContent = allOpen ? 'ยุบทั้งหมด' : 'ขยายทั้งหมด';
    expand.dataset.expanded = String(allOpen);
    expand.disabled = !visible.length;
  }

  function apply(updateUrl = true) {
    const words = normalize(search.value).split(/\s+/).filter(Boolean);
    library.dataset.filtered = String(words.length > 0 || activeGroup !== 'all');
    let total = 0;
    for (const group of groups) {
      let count = 0;
      for (const card of group.querySelectorAll('[data-meaning-search]')) {
        card.hidden = !words.every(word => searchable.get(card).includes(word));
        if (!card.hidden) count++;
      }
      group.hidden = (activeGroup !== 'all' && activeGroup !== group.id) || count === 0;
      group.querySelector('.tarot-group-count').textContent = `${count} ใบ`;
      if (!group.hidden) {
        total += count;
        if (words.length || activeGroup !== 'all') group.open = true;
      }
    }
    select.value = activeGroup;
    categories.forEach(link => link.setAttribute('aria-current', String(link.dataset.meaningCategory === activeGroup)));
    library.querySelector('[data-library-status]').textContent = words.length ? `พบ ${total} ใบจากคำค้น “${search.value.trim()}”` : `ทั้งหมด ${total} ใบ`;
    library.querySelector('[data-library-empty]').hidden = total !== 0;
    updateExpand();
    if (updateUrl) {
      const url = new URL(location.href);
      activeGroup === 'all' ? url.searchParams.delete('group') : url.searchParams.set('group', activeGroup);
      search.value.trim() ? url.searchParams.set('q', search.value.trim()) : url.searchParams.delete('q');
      url.hash = '';
      history.replaceState(history.state, '', url);
    }
    // Keep the library context in detail links without using browser storage.
    cards.forEach(card => {
      const url = new URL(card.href);
      activeGroup === 'all' ? url.searchParams.delete('group') : url.searchParams.set('group', activeGroup);
      search.value.trim() ? url.searchParams.set('q', search.value.trim()) : url.searchParams.delete('q');
      card.href = `${url.pathname}${url.search}`;
    });
  }
  function restore() {
    const url = new URL(location.href);
    activeGroup = validGroup(url.searchParams.get('group') || url.hash.slice(1));
    search.value = url.searchParams.get('q') || '';
    apply(false);
  }
  categories.forEach(link => link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    activeGroup = validGroup(link.dataset.meaningCategory);
    apply();
  }));
  select.addEventListener('change', () => { activeGroup = validGroup(select.value); apply(); });
  search.addEventListener('input', () => apply());
  search.form.addEventListener('submit', event => { event.preventDefault(); apply(); });
  library.querySelector('[data-library-reset]').addEventListener('click', () => {
    activeGroup = 'all'; search.value = ''; groups.forEach(group => { group.open = group.id === 'major'; }); apply(); search.focus();
  });
  expand.addEventListener('click', () => {
    const open = expand.dataset.expanded !== 'true';
    groups.filter(group => !group.hidden).forEach(group => { group.open = open; });
    updateExpand();
  });
  groups.forEach(group => group.addEventListener('toggle', updateExpand));
  window.addEventListener('popstate', restore);
  window.addEventListener('hashchange', restore);
  document.addEventListener('mw:cms-content-ready', () => {
    cards.forEach(card => searchable.set(card, normalize(`${card.dataset.meaningSearch} ${card.textContent}`)));
    apply(false);
  });
  library.querySelectorAll('[data-library-enhancement]').forEach(el => { el.hidden = false; });
  restore();
}

// Detail navigation retains a filtered return path but cannot leave this origin.
if (document.querySelector('[data-meaning-detail]')) {
  const params = new URLSearchParams(location.search);
  const context = new URLSearchParams();
  for (const key of ['group', 'q']) if (params.get(key)) context.set(key, params.get(key));
  document.querySelectorAll('[data-meaning-context-link]').forEach(link => {
    const url = new URL(link.href);
    url.search = context.toString();
    link.href = `${url.pathname}${url.search}${url.hash}`;
  });
}
