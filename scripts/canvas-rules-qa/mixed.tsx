import React,{useState} from "react";
import {CanvasImport} from "../../components/canvas-import";
import {mixedUpdatesFixture} from "../fixtures/canvas-mixed-updates";
import {confirmCanvasImport} from "../../lib/canvas-history";
export function MixedQA(){
  const [fixture]=useState(mixedUpdatesFixture),[board,setBoard]=useState(fixture.board),[open,setOpen]=useState(true),[writes,setWrites]=useState(0),[json,setJson]=useState(false);
  return <main style={{maxWidth:1050,margin:"20px auto",padding:24}}><h1>Synthetic mixed updates</h1><p>No live account. Test writes: {writes}</p><button onClick={()=>setOpen(true)}>Reopen preview</button><button onClick={()=>{setOpen(false);setJson(true);}}>Use JSON</button>
    {open&&<CanvasImport semester={board} initialRaw={json?undefined:fixture.raw} onClose={()=>setOpen(false)} onApply={(b,c,expected)=>{if(expected!==board)throw new Error("Stale review");setBoard(confirmCanvasImport(board,b,c,`mixed-${writes}`).semester);setWrites(writes+1);}}/>}
  </main>;
}
