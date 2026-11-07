const dayKey = value => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));

export function leadScore(lead, state, now = Date.now()) {
  let score = 34;
  const contact = (state.data.crm_contacts || []).find(item => item.$id === lead.contact_id);
  const company = (state.data.crm_companies || []).find(item => item.$id === lead.company_id);
  const probability = Number(lead.probability || 0);
  score += Math.round(clamp(probability, 0, 100) * 0.22);
  if (contact) score += 10;
  if (contact?.email || contact?.phone || contact?.mobile) score += 6;
  if (company) score += 8;
  if (lead.source) score += 4;

  const status = String(lead.status || 'new').toLowerCase();
  if (['qualified', 'converted'].includes(status)) score += 15;
  else if (['contacted', 'working'].includes(status)) score += 8;
  else if (['disqualified', 'lost'].includes(status)) score -= 28;

  if (lead.next_follow_up) {
    const followUp = new Date(lead.next_follow_up).getTime();
    if (Number.isFinite(followUp)) {
      if (followUp < now) score -= 12;
      else if (followUp - now <= 7 * 86400000) score += 10;
      else score += 4;
    }
  } else if (!['converted', 'disqualified', 'lost'].includes(status)) {
    score -= 5;
  }

  const createdAt = new Date(lead.$createdAt || 0).getTime();
  if (createdAt && now - createdAt <= 14 * 86400000) score += 5;
  return clamp(score);
}

export function dealHealth(deal, state, now = Date.now()) {
  let score = 72;
  const status = String(deal.status || 'open').toLowerCase();
  if (['won', 'lost', 'closed'].includes(status)) {
    return { score: status === 'won' ? 100 : 0, label: status === 'won' ? 'Won' : 'Closed', reasons: [] };
  }

  const expected = deal.expected_close_date ? new Date(deal.expected_close_date).getTime() : 0;
  if (!expected) score -= 8;
  else if (expected < now) score -= 26;
  else if (expected - now <= 7 * 86400000) score -= 5;

  const relatedActivities = (state.data.crm_activities || []).filter(
    item => item.related_type === 'deal' && item.related_id === deal.$id
  );
  const latestActivity = relatedActivities
    .map(item => new Date(item.occurred_at || item.$createdAt || 0).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];
  if (!latestActivity) score -= 12;
  else {
    const idleDays = Math.floor((now - latestActivity) / 86400000);
    if (idleDays > 30) score -= 22;
    else if (idleDays > 14) score -= 12;
    else if (idleDays <= 3) score += 5;
  }

  const relatedTasks = (state.data.crm_tasks || []).filter(
    item => item.related_type === 'deal' && item.related_id === deal.$id && item.status !== 'completed'
  );
  const hasFutureTask = relatedTasks.some(item => item.due_at && new Date(item.due_at).getTime() >= now);
  const hasOverdueTask = relatedTasks.some(item => item.due_at && new Date(item.due_at).getTime() < now);
  if (hasOverdueTask) score -= 14;
  else if (hasFutureTask) score += 10;
  else score -= 7;

  const reasons = [];
  if (expected && expected < now) reasons.push('Expected close date has passed');
  if (!latestActivity || now - latestActivity > 14 * 86400000) reasons.push('No recent customer activity');
  if (hasOverdueTask) reasons.push('Follow-up task is overdue');
  if (!hasFutureTask && !hasOverdueTask) reasons.push('No next action is scheduled');

  const finalScore = clamp(score);
  return {
    score: finalScore,
    label: finalScore >= 72 ? 'Healthy' : finalScore >= 48 ? 'At risk' : 'Needs attention',
    reasons
  };
}

function scoreColor(score) {
  return score >= 72 ? 'good' : score >= 48 ? 'warn' : 'bad';
}

export function renderInsights(state, ui) {
  const leads = state.data.crm_leads || [];
  const deals = state.data.crm_deals || [];
  const tasks = state.data.crm_tasks || [];
  const contacts = state.data.crm_contacts || [];
  const activities = state.data.crm_activities || [];
  const openDeals = deals.filter(item => !['won', 'lost', 'closed'].includes(String(item.status || '').toLowerCase()));
  const wonDeals = deals.filter(item => String(item.status || '').toLowerCase() === 'won');
  const lostDeals = deals.filter(item => String(item.status || '').toLowerCase() === 'lost');
  const overdueTasks = tasks.filter(item => item.status !== 'completed' && item.due_at && new Date(item.due_at).getTime() < Date.now());
  const weighted = openDeals.reduce((sum, item) => sum + Number(item.value || 0) * Number(item.probability || 0) / 100, 0);
  const decided = wonDeals.length + lostDeals.length;
  const winRate = decided ? Math.round(wonDeals.length / decided * 100) : 0;
  const averageLeadScore = leads.length ? Math.round(leads.reduce((sum, lead) => sum + leadScore(lead, state), 0) / leads.length) : 0;

  const sourceMap = new Map();
  for (const lead of leads) {
    const source = lead.source || 'Unspecified';
    sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
  }
  const sourceRows = [...sourceMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const sourceMax = Math.max(1, ...sourceRows.map(item => item[1]));
  const sourceMarkup = sourceRows.length
    ? sourceRows.map(([name, count]) => `<div class="pro-source-row"><span>${ui.esc(name)}</span><div class="pro-track"><i style="width:${Math.max(3, count / sourceMax * 100)}%"></i></div><b>${count}</b></div>`).join('')
    : '<div class="pro-empty">Add lead sources to see which channels are generating opportunities.</div>';

  const priorityLeads = [...leads]
    .filter(item => !['converted', 'disqualified', 'lost'].includes(String(item.status || '').toLowerCase()))
    .map(item => ({ ...item, smartScore: leadScore(item, state) }))
    .sort((a, b) => b.smartScore - a.smartScore)
    .slice(0, 6);
  const leadMarkup = priorityLeads.length
    ? priorityLeads.map(item => {
        const relatedContact = contacts.find(contact => contact.$id === item.contact_id);
        const score = item.smartScore;
        return `<div class="pro-priority-row">
          <div class="pro-score ${scoreColor(score)}">${score}</div>
          <div class="pro-priority-copy"><b>${ui.esc(item.title)}</b><small>${ui.esc(relatedContact?.full_name || item.source || 'Lead')} · ${ui.esc(item.status || 'new')}</small></div>
          <button class="pro-mini-action" data-action="new-task-for-lead" data-id="${ui.esc(item.$id)}">Plan follow-up</button>
        </div>`;
      }).join('')
    : '<div class="pro-empty">Your priority lead list will appear here when you add leads.</div>';

  const atRisk = openDeals.map(item => ({ ...item, health: dealHealth(item, state) }))
    .filter(item => item.health.score < 72)
    .sort((a, b) => a.health.score - b.health.score)
    .slice(0, 5);
  const riskMarkup = atRisk.length
    ? atRisk.map(item => `<div class="pro-risk-row">
        <div class="pro-risk-top"><b>${ui.esc(item.title)}</b><span class="pro-risk-pill ${scoreColor(item.health.score)}">${item.health.label} · ${item.health.score}/100</span></div>
        <div class="pro-risk-value">${ui.money(item.value)}</div>
        <small>${ui.esc(item.health.reasons[0] || 'Review the next customer action')}</small>
        <button class="pro-mini-action" data-action="new-task-for-deal" data-id="${ui.esc(item.$id)}">Create action</button>
      </div>`).join('')
    : '<div class="pro-empty">No deal risks detected in the records currently loaded.</div>';

  const stages = state.stages || [];
  const stageRows = stages.map(stage => {
    const stageDeals = openDeals.filter(item => item.stage_id === stage.$id);
    return { name: stage.name, count: stageDeals.length, value: stageDeals.reduce((sum, item) => sum + Number(item.value || 0), 0) };
  });
  const stageMax = Math.max(1, ...stageRows.map(item => item.value));
  const stageMarkup = stageRows.length
    ? stageRows.map(item => `<div class="pro-forecast-row">
        <div class="pro-forecast-label"><b>${ui.esc(item.name)}</b><small>${item.count} deal${item.count === 1 ? '' : 's'}</small></div>
        <div class="pro-track"><i style="width:${Math.max(2, item.value / stageMax * 100)}%"></i></div>
        <strong>${ui.money(item.value)}</strong>
      </div>`).join('')
    : '<div class="pro-empty">Create a sales pipeline to see stage performance.</div>';

  const nextActions = [
    overdueTasks.length ? `Review ${overdueTasks.length} overdue follow-up task${overdueTasks.length === 1 ? '' : 's'}.` : 'Keep follow-up tasks up to date.',
    atRisk.length ? `Review ${atRisk.length} deal${atRisk.length === 1 ? '' : 's'} that may need attention.` : 'Your loaded deals have no immediate risk flags.',
    leads.length ? `Prioritise the ${priorityLeads.length} highest-scoring active lead${priorityLeads.length === 1 ? '' : 's'}.` : 'Add your first leads to start building a qualified pipeline.'
  ];

  return `
    <div class="page-head">
      <div><span class="pro-eyebrow">ETHAN SALES INTELLIGENCE</span><h1>Sales intelligence</h1><p>See where revenue is coming from, which deals need attention and who your team should contact next.</p></div>
      <div class="head-actions"><button class="button secondary" data-action="navigate" data-value="calendar">Open calendar</button><button class="button primary" data-action="navigate" data-value="leads">Manage leads</button></div>
    </div>
    <div class="pro-banner"><div><span class="pro-eyebrow light">YOUR SALES COCKPIT</span><h2>Make the next move with confidence.</h2><p>ETHAN Smart Score uses visible CRM signals to prioritise leads. Deal health highlights follow-up and closing-date risks.</p></div><div class="pro-banner-mark">E<span>+</span></div></div>
    <div class="stats-grid pro-stats">
      ${ui.cardStat('Weighted pipeline', ui.money(weighted), '↗', 'Open deal value × probability')}
      ${ui.cardStat('Win rate', `${winRate}%`, '◎', `${wonDeals.length} won · ${lostDeals.length} lost`)}
      ${ui.cardStat('Average lead score', `${averageLeadScore}/100`, '✦', `${leads.length} leads analysed`)}
      ${ui.cardStat('Overdue follow-ups', overdueTasks.length, '◷', 'Tasks awaiting attention')}
    </div>
    <div class="pro-insight-grid">
      <section class="panel pro-panel"><div class="panel-head"><div><h3>Pipeline by stage</h3><p>Open opportunity value across your current pipeline</p></div><button class="text-link" data-action="navigate" data-value="pipeline">Open pipeline →</button></div><div class="pro-forecast-list">${stageMarkup}</div></section>
      <section class="panel pro-panel"><div class="panel-head"><div><h3>Lead sources</h3><p>Where your active lead records came from</p></div><span class="pro-panel-icon">◎</span></div><div class="pro-source-list">${sourceMarkup}</div></section>
      <section class="panel pro-panel"><div class="panel-head"><div><h3>Priority leads</h3><p>Highest ETHAN Smart Scores first</p></div><button class="text-link" data-action="navigate" data-value="leads">All leads →</button></div><div class="pro-priority-list">${leadMarkup}</div></section>
      <section class="panel pro-panel"><div class="panel-head"><div><h3>Deals needing attention</h3><p>Based on close dates, activity and next actions</p></div><button class="text-link" data-action="navigate" data-value="deals">All deals →</button></div><div class="pro-risk-list">${riskMarkup}</div></section>
    </div>
    <section class="panel pro-actions-panel"><div class="panel-head"><div><h3>Recommended next actions</h3><p>Practical steps based on the records currently loaded</p></div><span class="pro-panel-icon">✦</span></div><div class="pro-action-grid">${nextActions.map((item, index) => `<div class="pro-action-card"><span>0${index + 1}</span><p>${ui.esc(item)}</p></div>`).join('')}</div><div class="pro-disclaimer">Smart Score and deal-health indicators are transparent rule-based guidance, not predictions from a trained AI model. Insights reflect the CRM records currently loaded in this workspace.</div></section>
  `;
}

export function renderCalendar(state, ui) {
  const anchor = state.calendarDate instanceof Date ? state.calendarDate : new Date();
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstDay = new Date(year, month, 1);
  const offset = firstDay.getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const tasks = (state.data.crm_tasks || []).filter(item => item.status !== 'completed' && item.due_at);
  const activities = (state.data.crm_activities || []).filter(item => item.occurred_at);
  const byDay = new Map();

  const add = (dateValue, item) => {
    const key = dayKey(dateValue);
    if (!key) return;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(item);
  };
  tasks.forEach(item => add(item.due_at, { kind: 'task', title: item.title, item }));
  activities.forEach(item => add(item.occurred_at, { kind: 'activity', title: item.subject, item }));

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push('<div class="pro-calendar-cell is-empty"></div>');
  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(year, month, day);
    const key = dayKey(date);
    const items = (byDay.get(key) || []).sort((a, b) => a.kind.localeCompare(b.kind));
    const today = key === dayKey(new Date());
    const eventMarkup = items.slice(0, 3).map(event => `<div class="pro-cal-event ${event.kind}" title="${ui.esc(event.title)}"><i></i><span>${ui.esc(event.title || (event.kind === 'task' ? 'Task' : 'Activity'))}</span></div>`).join('');
    const extra = items.length > 3 ? `<small class="pro-cal-more">+${items.length - 3} more</small>` : '';
    cells.push(`<div class="pro-calendar-cell ${today ? 'is-today' : ''}"><span class="pro-cal-day">${day}</span><div class="pro-cal-events">${eventMarkup}</div>${extra}</div>`);
  }
  while (cells.length % 7 !== 0) cells.push('<div class="pro-calendar-cell is-empty"></div>');

  const monthLabel = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(firstDay);
  const openTaskCount = tasks.filter(item => new Date(item.due_at).getTime() >= Date.now()).length;
  const overdueTaskCount = tasks.length - openTaskCount;
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthActivities = activities.filter(item => dayKey(item.occurred_at).startsWith(monthKey)).length;
  const monthTasks = tasks.filter(item => dayKey(item.due_at).startsWith(monthKey)).length;

  return `
    <div class="page-head"><div><span class="pro-eyebrow">TIME & ACTIVITY MANAGEMENT</span><h1>Calendar</h1><p>Coordinate follow-ups, meetings, calls and customer touchpoints in one place.</p></div><div class="head-actions"><button class="button secondary" data-action="new" data-value="tasks">＋ New task</button><button class="button primary" data-action="new" data-value="activities">＋ Log activity</button></div></div>
    <div class="pro-calendar-summary">
      <div><span>Open tasks</span><b>${tasks.length}</b><small>${overdueTaskCount} overdue · ${openTaskCount} upcoming</small></div>
      <div><span>Activities this month</span><b>${monthActivities}</b><small>Calls, meetings, notes and emails</small></div>
      <div><span>Tasks due this month</span><b>${monthTasks}</b><small>Completed tasks are hidden</small></div>
    </div>
    <section class="panel pro-calendar-panel">
      <div class="pro-calendar-toolbar"><div><h2>${monthLabel}</h2><p>Local calendar dates · ${activities.length + tasks.length} loaded events</p></div><div class="pro-calendar-nav"><button class="button ghost" data-action="calendar-prev" aria-label="Previous month">←</button><button class="button secondary" data-action="calendar-today">Today</button><button class="button ghost" data-action="calendar-next" aria-label="Next month">→</button></div></div>
      <div class="pro-calendar-grid pro-calendar-headings">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => `<div>${day}</div>`).join('')}</div>
      <div class="pro-calendar-grid">${cells.join('')}</div>
      <div class="pro-calendar-legend"><span><i class="task"></i> Tasks and follow-ups</span><span><i class="activity"></i> Customer activities</span></div>
    </section>
    <div class="pro-calendar-footnote">The calendar displays the latest 100 tasks and 100 activities loaded for this workspace. Use the Tasks and Activities modules to search and manage individual records.</div>
  `;
}

export function renderContact360(contact, state, ui) {
  if (!contact) return '<div class="notice error">This contact could not be found.</div>';
  const company = (state.data.crm_companies || []).find(item => item.$id === contact.company_id);
  const deals = (state.data.crm_deals || []).filter(item => item.contact_id === contact.$id);
  const tasks = (state.data.crm_tasks || []).filter(item => item.related_type === 'contact' && item.related_id === contact.$id);
  const activities = (state.data.crm_activities || []).filter(item => item.related_type === 'contact' && item.related_id === contact.$id);
  const events = [
    ...activities.map(item => ({ kind: 'activity', date: item.occurred_at || item.$createdAt, title: item.subject, detail: item.description || item.type, item })),
    ...tasks.map(item => ({ kind: 'task', date: item.due_at || item.$createdAt, title: item.title, detail: `Task · ${item.status || 'open'}`, item })),
    ...deals.map(item => ({ kind: 'deal', date: item.$updatedAt || item.$createdAt, title: item.title, detail: `Deal · ${ui.money(item.value)} · ${item.status || 'open'}`, item }))
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 20);
  const lastTouch = activities.map(item => new Date(item.occurred_at || 0).getTime()).filter(Number.isFinite).sort((a, b) => b - a)[0];
  const daysSinceTouch = lastTouch ? Math.floor((Date.now() - lastTouch) / 86400000) : null;
  const relationship = daysSinceTouch === null ? 'No logged touchpoints' : daysSinceTouch <= 7 ? 'Recently engaged' : daysSinceTouch <= 30 ? 'Needs a check-in' : 'At risk of going cold';
  const timeline = events.length
    ? events.map(event => `<div class="pro-timeline-item"><div class="pro-timeline-marker ${event.kind}"></div><div class="pro-timeline-copy"><div><b>${ui.esc(event.title || event.kind)}</b><small>${ui.dateTime(event.date)}</small></div><p>${ui.esc(event.detail || '')}</p></div></div>`).join('')
    : '<div class="pro-empty">No related activity, tasks or deals have been recorded for this contact yet.</div>';

  return `
    <div class="pro-contact-modal-head"><div class="pro-contact-avatar">${ui.esc(ui.initials(contact.full_name))}</div><div><span class="pro-eyebrow">CUSTOMER 360°</span><h2>${ui.esc(contact.full_name)}</h2><p>${ui.esc(contact.job_title || 'Contact')}${company ? ` · ${ui.esc(company.name)}` : ''}</p></div></div>
    <div class="pro-contact-actions"><button class="button primary" data-action="new-task-for-contact" data-id="${ui.esc(contact.$id)}">＋ Create task</button><button class="button secondary" data-action="new-activity-for-contact" data-id="${ui.esc(contact.$id)}">＋ Log activity</button>${contact.email ? `<a class="button ghost" href="mailto:${ui.esc(contact.email)}">Email contact ↗</a>` : ''}</div>
    <div class="pro-contact-grid">
      <div class="pro-contact-info"><h3>Contact information</h3><dl><dt>Email</dt><dd>${contact.email ? `<a href="mailto:${ui.esc(contact.email)}">${ui.esc(contact.email)}</a>` : 'Not provided'}</dd><dt>Phone</dt><dd>${ui.esc(contact.phone || contact.mobile || 'Not provided')}</dd><dt>Source</dt><dd>${ui.esc(contact.source || 'Not recorded')}</dd><dt>Last contacted</dt><dd>${ui.dateTime(contact.last_contacted_at)}</dd><dt>Relationship health</dt><dd><span class="pro-health-label">${ui.esc(relationship)}</span></dd></dl></div>
      <div class="pro-contact-stats"><div><span>Related deals</span><b>${deals.length}</b></div><div><span>Open tasks</span><b>${tasks.filter(item => item.status !== 'completed').length}</b></div><div><span>Activities</span><b>${activities.length}</b></div><div><span>Deal value</span><b>${ui.money(deals.filter(item => !['lost','closed'].includes(String(item.status || '').toLowerCase())).reduce((sum, item) => sum + Number(item.value || 0), 0))}</b></div></div>
    </div>
    <section class="pro-contact-timeline"><div class="panel-head"><div><h3>Relationship timeline</h3><p>Calls, meetings, emails, notes, tasks and linked opportunities</p></div></div><div class="pro-timeline">${timeline}</div></section>
  `;
}
