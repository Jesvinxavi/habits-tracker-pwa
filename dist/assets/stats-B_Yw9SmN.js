import{s as R,g as C,b as S,i as b,a as B,c as F,d as D,f as T}from"./index-CWk_d2Bu.js";import"./vendor-DbHZnqlu.js";let p="habits";function at(){j(),Y(),R(()=>{E()}),E()}function j(){const t=document.getElementById("stats-view");t&&(t.innerHTML="",A())}function A(){const t=document.getElementById("stats-view");if(!t)return;const e=document.createElement("header");e.className="app-header flex justify-between items-center h-11 px-4 sm:px-6 lg:px-8 border-b border-gray-200 dark:border-gray-700 border-opacity-50 w-full",e.innerHTML=`
    <div></div>
    <h1 class="app-title text-left flex-grow text-[36px] font-extrabold leading-none flex items-end">Statistics</h1>
    <div></div>
  `,t.appendChild(e)}function Y(){const t=document.getElementById("stats-view");if(!t)return;const e=document.createElement("div");e.className="stats-container flex-1 overflow-y-auto overscroll-behavior-contain px-4 py-4 pb-8",e.id="stats-container",t.appendChild(e)}function E(){const t=document.getElementById("stats-container");if(t){t.innerHTML='<div class="loading-state p-8 text-center"><div class="loading-shimmer h-32 rounded-xl mb-4"></div><div class="loading-shimmer h-24 rounded-xl"></div></div>';try{const e=M(),a=I();t.innerHTML="",q(t,e,a),U(t),W(t,e,a),e.totalHabits===0&&a.totalActivities===0&&_(t)}catch{t.innerHTML=`
      <div class="error-state p-8 text-center">
        <div class="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full mx-auto mb-4 flex items-center justify-center">
          <svg class="w-8 h-8 text-red-600 dark:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.349 16.5c-.77.833.192 2.5 1.732 2.5z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Error Loading Statistics</h3>
        <p class="text-gray-600 dark:text-gray-400">Please try refreshing the page</p>
      </div>
    `}}}function M(){const t=(C().habits||[]).filter(J),e=new Date,a={totalHabits:t.length,activeHabits:t.filter(n=>!n.paused).length,pausedHabits:t.filter(n=>n.paused).length,completedToday:0,streaks:[],categoryBreakdown:new Map,completionRates:new Map,longestStreak:0,currentStreak:0,averageCompletionRate:0,dailyHabits:[],weeklyHabits:[],monthlyHabits:[],yearlyHabits:[],dailyCompletionRate:0,weeklyCompletionRate:0,monthlyCompletionRate:0,holidayDaysThisYear:0};if(t.forEach(n=>{if(!n.paused)try{const g=f(()=>H(n,30),0);if(a.completionRates.set(n.id,{habitName:n.name,rate:g,categoryId:n.categoryId,habitId:n.id}),S(n,"daily")?a.dailyHabits.push(n):S(n,"weekly")?a.weeklyHabits.push(n):S(n,"monthly")?a.monthlyHabits.push(n):S(n,"yearly")&&a.yearlyHabits.push(n),S(n,"daily")){const x=f(()=>V(n),0),c=f(()=>z(n),0);a.streaks.push({habitName:n.name,currentStreak:x,longestStreak:c,categoryId:n.categoryId})}b(n,e)&&a.completedToday++;const u=n.categoryId;a.categoryBreakdown.has(u)||a.categoryBreakdown.set(u,{count:0,completionRate:0,habits:[]});const y=a.categoryBreakdown.get(u);y.count++,y.habits.push({name:n.name,completionRate:g})}catch{}}),a.categoryBreakdown.forEach((n,g)=>{const u=n.habits.reduce((y,x)=>y+(x.completionRate||0),0);n.completionRate=n.habits.length>0?u/n.habits.length:0}),a.dailyHabits.length>0){const n=a.dailyHabits.map(g=>f(()=>H(g,30),0));a.dailyCompletionRate=n.reduce((g,u)=>g+u,0)/n.length}if(a.weeklyHabits.length>0){const n=a.weeklyHabits.map(g=>f(()=>X(g,4),0));a.weeklyCompletionRate=n.reduce((g,u)=>g+u,0)/n.length}if(a.monthlyHabits.length>0){const n=a.monthlyHabits.map(g=>f(()=>O(g,3),0));a.monthlyCompletionRate=n.reduce((g,u)=>g+u,0)/n.length}const s=Array.from(a.completionRates.values()).filter(n=>a.dailyHabits.some(g=>g.id===n.habitId)),r=s.reduce((n,g)=>n+(g.rate||0),0);a.averageCompletionRate=s.length>0?r/s.length:0;const i=e.getFullYear(),m=new Date(i,0,1),d=new Date(i,11,31);let l=0;const o=new Date(m);for(;o<=d;)B(o.toISOString())&&l++,o.setDate(o.getDate()+1);return a.holidayDaysThisYear=l,a.longestStreak=f(()=>P(a.dailyHabits),0),a}function H(t,e=30){const a=new Date;let s=0,r=0,i;if(typeof t.id=="string"&&/^[0-9]{13}/.test(t.id)){const l=parseInt(t.id.slice(0,13),10);Number.isNaN(l)||(i=new Date(l))}(!i||isNaN(i))&&(i=new Date);const m=Math.floor((a-i)/(1e3*60*60*24))+1,d=Math.min(e,m);for(let l=0;l<d;l++){const o=new Date(a);o.setDate(a.getDate()-l),!(o<i)&&D(t,o)&&(r++,b(t,o)&&s++)}return r>0?s/r*100:0}function X(t,e=4){const a=new Date;let s=0,r=0,i;if(typeof t.id=="string"&&/^[0-9]{13}/.test(t.id)){const l=parseInt(t.id.slice(0,13),10);Number.isNaN(l)||(i=new Date(l))}(!i||isNaN(i))&&(i=new Date);const m=Math.floor((a-i)/(1e3*60*60*24*7))+1,d=Math.min(e,m);for(let l=0;l<d;l++){const o=new Date(a);o.setDate(a.getDate()-l*7);const n=o.getDay(),g=n===0?6:n-1;o.setDate(o.getDate()-g),o.setHours(0,0,0,0);const u=new Date(o);u.setDate(o.getDate()+6),u.setHours(23,59,59,999);let y=!1,x=!1;const c=new Date(o);for(;c<=u;){if(c>=i&&D(t,c)&&(y=!0,b(t,c))){x=!0;break}c.setDate(c.getDate()+1)}y&&(r++,x&&s++)}return r>0?s/r*100:0}function O(t,e=3){const a=new Date;let s=0,r=0,i;if(typeof t.id=="string"&&/^[0-9]{13}/.test(t.id)){const o=parseInt(t.id.slice(0,13),10);Number.isNaN(o)||(i=new Date(o))}(!i||isNaN(i))&&(i=new Date);const m=(a.getFullYear()-i.getFullYear())*12+(a.getMonth()-i.getMonth())+1,d=Math.min(e,m);for(let o=0;o<d;o++){const n=a.getMonth()-o,g=a.getFullYear(),u=n<0?g-1:g,y=n<0?n+12:n,x=new Date(u,y,1),c=new Date(u,y+1,0,23,59,59,999);let v=!1,h=!1;const k=new Date(x);for(;k<=c;){if(k>=i&&D(t,k)&&(v=!0,b(t,k))){h=!0;break}k.setDate(k.getDate()+1)}v&&(r++,h&&s++)}return r>0?s/r*100:0}function V(t){const e=new Date;let a=0,s=new Date(e);for(let r=0;r<365;r++){if(D(t,s))if(b(t,s))a++;else break;s.setDate(s.getDate()-1)}return a}function z(t){const e=new Date;let a=0,s=0;for(let r=365;r>=0;r--){const i=new Date(e);i.setDate(e.getDate()-r),D(t,i)&&(b(t,i)?(s++,a=Math.max(a,s)):s=0)}return a}function P(t){if(t.length===0)return 0;const e=new Date;let a=0,s=0;for(let r=365;r>=0;r--){const i=new Date(e);i.setDate(e.getDate()-r);const m=t.filter(o=>D(o,i));if(m.length===0)continue;m.filter(o=>b(o,i)).length===m.length?(s++,a=Math.max(a,s)):s=0}return a}function I(){const t=C().activities||[],e=C().recordedActivities||{},a={totalActivities:t.length,totalSessions:0,categoriesUsed:new Set,recentSessions:0,totalDuration:0,averageSessionDuration:0,restDaysLast30Days:0,restDaysPercentage:0};Object.values(e).forEach(d=>{d.forEach(l=>{if(a.totalSessions++,l.categoryId&&a.categoriesUsed.add(l.categoryId),l.duration){let o=parseInt(l.duration)||0;l.durationUnit==="hours"?o*=60:l.durationUnit==="seconds"&&(o/=60),a.totalDuration+=o}})});const s=new Date;s.setDate(s.getDate()-30),Object.entries(e).forEach(([d,l])=>{new Date(d)>=s&&(a.recentSessions+=l.length)}),a.averageSessionDuration=a.totalSessions>0?a.totalDuration/a.totalSessions:0;let r=0;const i=new Date(s),m=new Date;for(;i<=m;){const d=i.toISOString().split("T")[0];F(d)&&r++,i.setDate(i.getDate()+1)}return a.restDaysLast30Days=r,a.restDaysPercentage=r/30*100,a}function q(t,e,a){const s=document.createElement("div");s.className="overview-section mb-6",s.innerHTML=`
    <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">Overview</h2>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div class="stat-card bg-blue-50 dark:bg-blue-900 p-4 rounded-lg hover:scale-105 transition-transform">
        <div class="stat-value text-2xl font-bold text-blue-600 dark:text-blue-300">${w(e.totalHabits)}</div>
        <div class="stat-label text-sm text-blue-600 dark:text-blue-300">Total Habits</div>
      </div>
      <div class="stat-card bg-green-50 dark:bg-green-900 p-4 rounded-lg hover:scale-105 transition-transform">
        <div class="stat-value text-2xl font-bold text-green-600 dark:text-green-300">${w(e.completedToday)}</div>
        <div class="stat-label text-sm text-green-600 dark:text-green-300">Completed Today</div>
      </div>
      <div class="stat-card bg-purple-50 dark:bg-purple-900 p-4 rounded-lg hover:scale-105 transition-transform">
        <div class="stat-value text-2xl font-bold text-purple-600 dark:text-purple-300">${w(a.recentSessions)}</div>
        <div class="stat-label text-sm text-purple-600 dark:text-purple-300">Fitness Sessions</div>
        <div class="text-sm text-purple-600 dark:text-purple-300 mt-1">Last 30 days</div>
      </div>
      <div class="stat-card bg-orange-50 dark:bg-orange-900 p-4 rounded-lg hover:scale-105 transition-transform">
        <div class="stat-value text-2xl font-bold text-orange-600 dark:text-orange-300">${w(e.longestStreak)}</div>
        <div class="stat-label text-sm text-orange-600 dark:text-orange-300">Longest 100% Streak (Daily)</div>
      </div>
    </div>
  `,t.appendChild(s)}function N(t,e){const a=document.createElement("div");a.className="habit-stats-section mb-6";const s=[{label:"7d",rate:e.dailyHabits.length>0?e.dailyHabits.map(d=>f(()=>H(d,7),0)).reduce((d,l)=>d+l,0)/e.dailyHabits.length:0},{label:"30d",rate:e.dailyHabits.length>0?e.dailyHabits.map(d=>f(()=>H(d,30),0)).reduce((d,l)=>d+l,0)/e.dailyHabits.length:0},{label:"All Time",rate:e.dailyHabits.length>0?e.dailyHabits.map(d=>f(()=>H(d,3650),0)).reduce((d,l)=>d+l,0)/e.dailyHabits.length:0}],r=[];r.push(`
    <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
      <div class="text-2xl font-bold text-center mb-1 text-gray-900 dark:text-white">
        ${e.longestStreak}
      </div>
      <div class="text-center text-sm text-gray-600 dark:text-gray-400">
        Longest 100% Streak (Daily)
      </div>
    </div>
  `),e.weeklyHabits.length>0&&r.push(`
      <div class="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg">
        <div class="text-2xl font-bold text-center mb-1 text-blue-600 dark:text-blue-300">
          ${e.weeklyCompletionRate.toFixed(1)}%
        </div>
        <div class="text-center text-sm text-blue-600 dark:text-blue-300">
          Weekly habits avg
        </div>
      </div>
    `),e.monthlyHabits.length>0&&r.push(`
      <div class="bg-purple-50 dark:bg-purple-900 p-4 rounded-lg">
        <div class="text-2xl font-bold text-center mb-1 text-purple-600 dark:text-purple-300">
          ${e.monthlyCompletionRate.toFixed(1)}%
        </div>
        <div class="text-center text-sm text-purple-600 dark:text-purple-300">
          Monthly habits avg
        </div>
      </div>
    `),r.push(`
    <div class="bg-yellow-50 dark:bg-yellow-900 p-4 rounded-lg">
      <div class="text-2xl font-bold text-center mb-1 text-yellow-600 dark:text-yellow-300">
        ${e.holidayDaysThisYear}
      </div>
      <div class="text-center text-sm text-yellow-600 dark:text-yellow-300">
        Holiday days this year
      </div>
    </div>
  `);let i="grid gap-3 mb-4";r.length===1?i+=" grid-cols-1":i+=" grid-cols-2",a.innerHTML=`
    <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">Habit Stats</h2>
    
    <!-- Stats Tiles including Carousel -->
    <div class="${i}">
      <!-- Completion Carousel as a tile -->
      <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
        ${Q(s)}
      </div>
      
      ${r.join("")}
    </div>
  `;let m="";e.categoryBreakdown.forEach((d,l)=>{const o=C().categories.find(u=>u.id===l),n=o?o.name:"Unknown",g=o?o.color:"#888";m+=`
      <div class="category-stat mb-3 p-3 rounded-lg border-l-4 bg-gray-50 dark:bg-gray-800" style="border-left-color: ${g};">
        <div class="flex justify-between items-center">
          <span class="font-medium text-sm">${n}</span>
          <span class="text-sm text-gray-600 dark:text-gray-400">${d.count} habits</span>
        </div>
        <div class="text-sm text-gray-600 dark:text-gray-400">
          Avg: ${d.completionRate.toFixed(1)}%
        </div>
      </div>
    `}),a.innerHTML+=`
    ${m?`<div class="category-breakdown">
      <h3 class="text-lg font-medium mb-3 text-gray-900 dark:text-white">By Category</h3>
      ${m}
    </div>`:""}
  `,t.appendChild(a),setTimeout(()=>{Z()},100)}function $(t,e){const a=document.createElement("div");a.className="fitness-stats-section mb-8 pb-6",a.innerHTML=`
    <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">Fitness Stats</h2>
    
    <div class="grid grid-cols-2 gap-3">
      <div class="stat-card bg-red-50 dark:bg-red-900 p-4 rounded-lg hover:scale-105 transition-transform">
        <div class="stat-value text-2xl font-bold text-red-600 dark:text-red-300">${w(e.totalActivities)}</div>
        <div class="stat-label text-sm text-red-600 dark:text-red-300">Total Activities</div>
      </div>
      <div class="stat-card bg-indigo-50 dark:bg-indigo-900 p-4 rounded-lg hover:scale-105 transition-transform">
        <div class="stat-value text-2xl font-bold text-indigo-600 dark:text-indigo-300">${w(e.recentSessions)}</div>
        <div class="stat-label text-sm text-indigo-600 dark:text-indigo-300">Recent Sessions</div>
        <div class="text-sm text-indigo-600 dark:text-indigo-300 mt-1">Last 30 days</div>
      </div>
      <div class="stat-card bg-teal-50 dark:bg-teal-900 p-4 rounded-lg hover:scale-105 transition-transform">
        <div class="stat-value text-2xl font-bold text-teal-600 dark:text-teal-300">${T(e.totalDuration)}</div>
        <div class="stat-label text-sm text-teal-600 dark:text-teal-300">Total Time</div>
      </div>
      <div class="stat-card bg-pink-50 dark:bg-pink-900 p-4 rounded-lg hover:scale-105 transition-transform">
        <div class="stat-value text-2xl font-bold text-pink-600 dark:text-pink-300">${T(e.averageSessionDuration)}</div>
        <div class="stat-label text-sm text-pink-600 dark:text-pink-300">Avg Session</div>
      </div>
    </div>
    
    <div class="grid grid-cols-1 gap-3 mt-4">
      <div class="stat-card bg-gray-50 dark:bg-gray-800 p-4 rounded-lg hover:scale-105 transition-transform">
        <div class="stat-value text-2xl font-bold text-center mb-1 text-gray-900 dark:text-white">
          ${e.restDaysLast30Days} (${e.restDaysPercentage.toFixed(1)}%)
        </div>
        <div class="text-center text-sm text-gray-600 dark:text-gray-400">
          Rest days (last 30 days)
        </div>
      </div>
    </div>
  `,t.appendChild(a)}function U(t){const e=document.createElement("div");e.className="stats-toggle-section mb-6",e.innerHTML=`
    <div class="toggle-container bg-gray-100 dark:bg-gray-800 p-1 rounded-xl inline-flex w-full max-w-md mx-auto">
      <button 
        id="habits-toggle" 
        class="toggle-btn flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all duration-300 ${p==="habits"?"bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm":"text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"}"
        data-view="habits"
      >
        Habits
      </button>
      <button 
        id="fitness-toggle" 
        class="toggle-btn flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all duration-300 ${p==="fitness"?"bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm":"text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"}"
        data-view="fitness"
      >
        Fitness
      </button>
    </div>
  `,t.appendChild(e),G()}function W(t,e,a){const s=document.createElement("div");s.className="detailed-stats-section",s.id="detailed-stats-container",s.style.transition="opacity 0.3s ease, transform 0.3s ease",s.style.opacity="1",s.style.transform="translateY(0)",p==="habits"?(s.innerHTML="",N(s,e)):(s.innerHTML="",$(s,a)),t.appendChild(s)}function G(){const t=document.getElementById("habits-toggle"),e=document.getElementById("fitness-toggle");!t||!e||(t.addEventListener("click",()=>L("habits")),e.addEventListener("click",()=>L("fitness")))}function L(t){if(p===t)return;p=t;const e=document.getElementById("detailed-stats-container");e&&(e.style.opacity="0",e.style.transform="translateY(10px)",setTimeout(()=>{const a=M(),s=I();e.innerHTML="",p==="habits"?N(e,a):$(e,s),K(),e.style.opacity="1",e.style.transform="translateY(0)"},150))}function K(){const t=document.getElementById("habits-toggle"),e=document.getElementById("fitness-toggle");!t||!e||(t.className="toggle-btn flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all duration-300",e.className="toggle-btn flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all duration-300",p==="habits"?(t.className+=" bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm",e.className+=" text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"):(e.className+=" bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm",t.className+=" text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"))}function _(t){t.innerHTML=`
    <div class="empty-state flex flex-col items-center justify-center py-16 px-4 text-center">
      <div class="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
        <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">No Data Yet</h3>
      <p class="text-gray-600 dark:text-gray-400 max-w-sm mx-auto mb-6">
        Start tracking habits and fitness activities to see your personalized statistics here.
      </p>
      <button class="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors" onclick="document.querySelector('[data-view=&quot;home-view&quot;]').click()">
        Start Tracking
      </button>
    </div>
  `}function w(t){return t>=1e6?(t/1e6).toFixed(1)+"M":t>=1e3?(t/1e3).toFixed(1)+"K":t.toString()}function J(t){return t&&typeof t.id=="string"&&typeof t.name=="string"&&typeof t.paused=="boolean"}function f(t,e=0){try{const a=t();return isNaN(a)?e:a}catch{return e}}function Q(t){if(t.length===1){const s=t[0];return`
      <div class="text-lg font-bold text-center mb-1 text-gray-900 dark:text-white">
        ${s.rate.toFixed(1)}%
      </div>
      <div class="text-center text-xs text-gray-500 dark:text-gray-400">
        Completion Rate (${s.label})
      </div>
    `}const e=t.map((s,r)=>`
    <div class="carousel-slide ${r===0?"active":""}" data-slide="${r}">
      <div class="text-lg font-bold text-center mb-1 text-gray-900 dark:text-white">
        ${s.rate.toFixed(1)}%
      </div>
      <div class="text-center text-xs text-gray-500 dark:text-gray-400">
        Completion Rate (${s.label})
      </div>
    </div>
  `).join(""),a=t.map((s,r)=>`
    <div class="carousel-dot ${r===0?"active":""}" data-slide="${r}"></div>
  `).join("");return`
    <div class="completion-carousel" id="habit-completion-carousel">
      <div class="carousel-container">
        <div class="carousel-track" id="habit-carousel-track">
          ${e}
        </div>
      </div>
      <div class="carousel-dots" id="habit-carousel-dots">
        ${a}
      </div>
    </div>
  `}function Z(){const t=document.getElementById("habit-completion-carousel"),e=document.getElementById("habit-carousel-track"),a=document.getElementById("habit-carousel-dots");if(!t||!e||!a)return;const s=e.querySelectorAll(".carousel-slide"),r=a.querySelectorAll(".carousel-dot");if(s.length<=1)return;let i=0,m=0,d=0,l=null;function o(c){c<0||c>=s.length||(i=c,s.forEach((v,h)=>{v.classList.toggle("active",h===i)}),r.forEach((v,h)=>{v.classList.toggle("active",h===i)}))}function n(){const c=(i+1)%s.length;o(c)}function g(){const c=(i-1+s.length)%s.length;o(c)}r.forEach((c,v)=>{c.addEventListener("click",()=>{o(v)})}),t.addEventListener("touchstart",c=>{m=c.touches[0].clientX}),t.addEventListener("touchend",c=>{d=c.changedTouches[0].clientX,x()});let u=!1,y=0;t.addEventListener("mousedown",c=>{u=!0,y=c.clientX,t.style.cursor="grabbing"}),t.addEventListener("mousemove",c=>{u&&c.preventDefault()}),t.addEventListener("mouseup",c=>{if(!u)return;u=!1,t.style.cursor="grab";const v=c.clientX,h=y-v;Math.abs(h)>50&&(h>0?n():g())}),t.addEventListener("mouseleave",()=>{u&&(u=!1,t.style.cursor="grab")});function x(){const v=m-d;Math.abs(v)>50&&(v>0?n():g())}t.style.cursor="grab",l&&clearInterval(l),l=setInterval(()=>{n()},3e4),t.addEventListener("mouseenter",()=>{l&&clearInterval(l)}),t.addEventListener("mouseleave",()=>{l=setInterval(()=>{n()},3e4)})}export{at as initializeStats};
