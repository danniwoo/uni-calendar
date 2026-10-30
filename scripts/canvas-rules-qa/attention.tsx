import React,{useState} from "react";
import {CanvasImport} from "../../components/canvas-import";
import {attentionFixture} from "../fixtures/canvas-attention";
import {confirmCanvasImport} from "../../lib/canvas-history";
export function AttentionQA(){
  const [fixture]=useState(attentionFixture),[board,setBoard]=useState(fixture.board),[open,setOpen]=useState(true),[writes,setWrites]=useState(0);
  return <main style={{maxWidth:1100,margin:"20px auto",padding:24}}><h1>Synthetic result setup</h1><p>Invented data only · Test writes: {writes}</p><button onClick={()=>setOpen(true)}>Reopen preview</button>
    {open&&<CanvasImport semester={board} initialRaw={fixture.raw} onClose={()=>setOpen(false)} onApply={(b,c,expected)=>{if(expected!==board)throw new Error("Stale preview");setBoard(confirmCanvasImport(board,b,c,`attention-${writes}`).semester);setWrites(writes+1);setOpen(false);}}/>}
  </main>;
}
