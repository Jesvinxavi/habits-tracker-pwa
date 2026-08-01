/**
 * Seeds a running dev build with a realistic account, for manual and browser
 * verification of the statistics surfaces. Loaded by URL from the Vite dev
 * server; never imported by application code.
 */
window.__seedStats = async function (opts) {
  const o = opts || {};
  const habitCount = o.habits || 4;
  const historyDays = o.days || 400;
  const today = new Date();
  const iso = (d) => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const ago = (n) => { const d=new Date(today); d.setDate(d.getDate()-n); return d; };

  const categories = [
    { id:'cat-health', name:'Health', color:'#34C759' },
    { id:'cat-mind', name:'Mind', color:'#5856D6' },
  ];
  const habits = [];
  for (let h=0; h<habitCount; h++) {
    const completed = {};
    const skipped = [];
    for (let i=1;i<=historyDays;i++) {
      if ((i+h) % 17 === 0) { skipped.push(iso(ago(i))); continue; }
      completed[iso(ago(i))] = ((i+h) % 5 !== 0);
    }
    habits.push({
      id:'h'+h, name:['Meditate','Read','Stretch','Journal','Walk','Water','Vitamins','Floss'][h%8],
      paused:false, activeOnHolidays:false, frequency:'daily',
      categoryId: h%2 ? 'cat-mind' : 'cat-health',
      icon:['🧘','📚','🤸','📓','🚶','💧','💊','🦷'][h%8],
      createdAt: iso(ago(historyDays))+'T00:00:00.000',
      completed, skippedDates: skipped, sortOrder: h,
    });
  }
  // A weekly target habit, so target progress has something to show.
  const weeklyCompleted = {};
  const progress = {};
  for (let w=1; w<=20; w++) {
    const d = ago(w*7);
    const tmp=new Date(d); tmp.setHours(0,0,0,0); tmp.setDate(tmp.getDate()+4-(tmp.getDay()||7));
    const ys=new Date(tmp.getFullYear(),0,1);
    const wk=Math.ceil(((tmp-ys)/86400000+1)/7);
    const key = tmp.getFullYear()+'-W'+wk;
    if (w % 4 !== 0) weeklyCompleted[key] = true;
    progress[key] = (w % 4 !== 0) ? 3 : 1;
  }
  habits.push({
    id:'h-weekly', name:'Long run', paused:false, activeOnHolidays:false,
    frequency:'weekly', targetFrequency:'weekly', target:3, targetUnit:'runs',
    categoryId:'cat-health', icon:'🏃', createdAt: iso(ago(140))+'T00:00:00.000',
    completed: weeklyCompleted, progress, skippedDates: [], sortOrder: 99,
  });
  // A paused habit with real history, and an archived one.
  const pausedCompleted = {};
  for (let i=30;i<=200;i++) pausedCompleted[iso(ago(i))] = true;
  habits.push({ id:'h-paused', name:'Cold shower', paused:true, pausedAt: ago(30).getTime(),
    activeOnHolidays:false, frequency:'daily', categoryId:'cat-health', icon:'🚿',
    createdAt: iso(ago(200))+'T00:00:00.000', completed: pausedCompleted, skippedDates: [], sortOrder: 100 });

  const activityCategories = [
    { id:'cat-cardio', name:'Cardio', color:'#FF3B30', icon:'🏃', isSystemDefault:true, sortOrder:0 },
    { id:'cat-strength', name:'Strength', color:'#007AFF', icon:'🏋️', isSystemDefault:true, sortOrder:1 },
  ];
  const activities = [
    { id:'act-run', name:'Running', categoryId:'cat-cardio', icon:'🏃', trackingType:'time', createdAt: iso(ago(200))+'T00:00:00.000' },
    { id:'act-bench', name:'Bench Press', categoryId:'cat-strength', icon:'🏋️', trackingType:'sets-reps', muscleGroup:'Chest', createdAt: iso(ago(200))+'T00:00:00.000' },
    { id:'act-squat', name:'Squat', categoryId:'cat-strength', icon:'🦵', trackingType:'sets-reps', muscleGroup:'Legs', createdAt: iso(ago(200))+'T00:00:00.000' },
  ];
  const rec = {};
  let n = 0;
  for (let i=0; i<90; i+=3) {
    const key = iso(ago(i));
    rec[key] = rec[key] || [];
    if (i % 2 === 0) {
      rec[key].push({ id:'r'+(n++), activityId:'act-run', activityName:'Running', categoryId:'cat-cardio',
        date:key, timestamp: ago(i).toISOString(), duration: (i%9===0)? 1.5 : 30+(i%40), durationUnit: (i%9===0)?'hours':'minutes',
        intensity: ['low','moderate','high'][i%3], notes:'' });
    } else {
      const w = 50 + (90-i)/3;
      rec[key].push({ id:'r'+(n++), activityId: i%4===1?'act-bench':'act-squat',
        activityName: i%4===1?'Bench Press':'Squat', categoryId:'cat-strength',
        date:key, timestamp: ago(i).toISOString(),
        sets:[{reps:10,value:w,unit:'kg'},{reps:8,value:w+5,unit:'kg'},{reps:6,value:w+10,unit:'kg'}], notes:'' });
    }
  }
  // One quick-record with no metrics at all.
  rec[iso(ago(1))] = (rec[iso(ago(1))]||[]).concat([{ id:'r-quick', activityId:'act-run', activityName:'Running',
    categoryId:'cat-cardio', date: iso(ago(1)), timestamp: ago(1).toISOString(), notes:'' }]);

  const restDays = {};
  for (let i=2;i<30;i+=6) restDays[iso(ago(i))] = true;

  window.__APP_TEST__.seed({ categories, habits, activityCategories, activities, recordedActivities: rec, restDays });
  return { habits: habits.length, records: n };
};
