import {getChatGPTUser} from "../../chatgpt-auth";
import {database} from "@/lib/storage";
import {accountResponse} from "@/lib/account";

export async function GET() {
  const user=await getChatGPTUser();
  return accountResponse(user?{owner:user.userId,email:user.email}:null,database);
}
