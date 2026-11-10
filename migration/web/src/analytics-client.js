const pattern=/^[A-Za-z0-9_-]{22,64}$/;

function randomId(bytes=18) {
  const data=crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...data)).replaceAll("+","-").replaceAll("/","_").replace(/=+$/g,"");
}

export function analyticsVisit(storage,scope) {
  let host="unconfigured";try{host=new URL(scope).hostname;}catch{}
  const key=`semester-analytics-visit-${host}`;
  try {const value=storage.getItem(key);if(value&&pattern.test(value))return value;}catch{}
  const value=randomId();try{storage.setItem(key,value);}catch{}return value;
}

export function analyticsEventId() {return crypto.randomUUID();}
