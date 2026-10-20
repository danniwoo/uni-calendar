"use client";
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogCancel,AlertDialogAction} from "@/components/ui/alert-dialog";

export function AssessmentConfirm({title,description,action,onConfirm,onCancel,cancelLabel="Keep editing"}:{title:string;description:string;action:string;onConfirm:()=>void;onCancel:()=>void;cancelLabel?:string}) {
  return <AlertDialog open onOpenChange={open=>{if(!open)onCancel();}}><AlertDialogContent>
    <AlertDialogTitle>{title}</AlertDialogTitle>
    <AlertDialogDescription>{description}</AlertDialogDescription>
    <div className="flex flex-wrap justify-end gap-2">
      <AlertDialogCancel onClick={onCancel}>{cancelLabel}</AlertDialogCancel>
      <AlertDialogAction onClick={onConfirm}>{action}</AlertDialogAction>
    </div>
  </AlertDialogContent></AlertDialog>;
}
