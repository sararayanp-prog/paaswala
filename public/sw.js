const suvichar = [
  "Aaj ka din tumhara hai, mehnat karo, PaasWala tumhare saath hai.",
  "Chhota kaam bhi kaam hota hai, izzat se karo.",
  "Paas ke logon ki madad karo, PaasWala badhega to tum bhi badhoge.",
  "Mehnat ka paisa meetha hota hai, aaj ek naya kaam dhoondo.",
  "Jo deta hai, usko milta hai. Aaj kisi ki madad karo.",
  "Sapna bada rakho, shuruaat paas se karo.",
  "Subah ki chai ke saath ek achha kaam socho, din achha jayega.",
  "Kaam chhota ya bada nahi hota, niyat badi honi chahiye.",
  "Aaj kisi ek ko kaam dilwa do, dua apne aap milegi.",
  "Dusron ke kaam aao, tumhara kaam apne aap ban jayega.",
  "Har subah ek naya mauka hai, kal ki thakan ko bhool jao.",
  "Mehnat karne wale ko kabhi haar nahi milti, sirf seekh milti hai.",
  "Paas wala hi sabse pehle kaam aata hai, uska saath do.",
  "Aaj ek naya skill seekho, kal usi se paisa aayega.",
  "Imandari se kiya kaam, sabse bada dhan hai.",
  "Kisi ka bura mat socho, tumhara din apne aap achha jayega.",
  "Chhoti shuruaat se ghabrao mat, bada ped bhi beej se hi banta hai.",
  "Aaj apne mohalle ke ek aadmi ki madad karo.",
  "Kaam ko kaam samajh ke karo, bojh samajh ke nahi.",
  "Jo subah jaldi uthta hai, usko kaam pehle milta hai.",
  "Apne haath ki mehnat se bada koi sukh nahi.",
  "Aaj muskura ke kaam karo, customer khud wapas aayega.",
  "Paise se zyada, bharosa kamao, paisa apne aap aayega.",
  "Kal jo nahi hua, aaj usko karke dikhao.",
  "Gareeb ki madad, sabse badi pooja hai.",
  "Aaj apne kaam ka ek photo daalo, log tumko pehchanenge.",
  "Rukna mat, thakna mat, PaasWala tumhare saath hai.",
  "Ek achha kaam, sau duaon ke barabar hai.",
  "Aaj ka suvichar - Koshish karne walon ki kabhi haar nahi hoti.",
  "Naya din, naya kaam, nayi ummeed. Chal pado."
];

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { self.clients.claim(); });

function getTodaySuvichar(){
  let now = new Date();
  let start = new Date(now.getFullYear(), 0, 0);
  let day = Math.floor((now - start) / (1000*60*60*24));
  return suvichar[day % suvichar.length];
}

function next9AM(){
  let now = new Date();
  let next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

setTimeout(function showDaily(){
  let msg = getTodaySuvichar();
  let fullMsg = msg + "\n\nPaasWala Available\nHum aapki aaj kya seva kare?";
  self.registration.showNotification('PaasWala - Good Morning 🌞', {
    body: fullMsg,
    icon: 'https://cdn-icons-png.flaticon.com/512/3081/3081559.png'
  });
  setTimeout(showDaily, 24*60*60*1000);
}, next9AM());
