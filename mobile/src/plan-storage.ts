import AsyncStorage from "@react-native-async-storage/async-storage";
import { PLAN_STORAGE_KEY, readPersonalPlan, serialisePersonalPlan, parsePlanSnapshot, type PersonalTask, type PlanSnapshot } from "./personal-plan";
import { getStagingClient, stagingSetup } from "./staging-auth";
import { stagingRequest, StagingApiError } from "./staging-core";

export type PlanStorage = {
  label:string;
  read:()=>Promise<PlanSnapshot>;
  write:(tasks:PersonalTask[],revision:number)=>Promise<PlanSnapshot>;
};
export const devicePlan: PlanStorage = {
  label:"on this iPhone",
  read:async()=>({revision:0,tasks:readPersonalPlan(await AsyncStorage.getItem(PLAN_STORAGE_KEY))}),
  write:async tasks=>{
    await AsyncStorage.setItem(PLAN_STORAGE_KEY,serialisePersonalPlan(tasks));
    return {revision:0,tasks};
  },
};
export function accountPlan(subject:string): PlanStorage {
  async function call(body?:unknown) {
    const {data,error}=await getStagingClient().auth.getSession();
    if(error || !stagingSetup.config || !data.session || data.session.user.id!==subject) throw new StagingApiError(401);
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),15000);
    try {
      return parsePlanSnapshot(await stagingRequest(stagingSetup.config,data.session.access_token,"/v1/today/plan",
        {method:body ? "PATCH" : "GET",body,signal:controller.signal}));
    } finally {clearTimeout(timer);}
  }
  return {label:"to your staging account",read:()=>call(),write:(tasks,expectedRevision)=>call({tasks,expectedRevision})};
}
