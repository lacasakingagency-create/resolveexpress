import React, { useState, useEffect } from "react";
import { Icon, Btn, Field, inputCls } from "./kit";
import { useStore, kz, formatCurrency } from "../lib/store";
import { useI18n } from "../lib/i18n";
import { PAYMENTS, ANGOLA_BANKS, type AngolaBank } from "../lib/data";
import {
  isSupabaseConfigured,
  uploadPaymentProofToStorage,
  executeWalletMovementStrict,
} from "../lib/supabase";

export interface PaymentCheckoutModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  itemType: "order" | "booking";
  itemId: string;
  totalAOA: number;
  customerName: string;
  customerPhone: string;
  deliveryAddress?: string;
  onPaymentSuccess: (details: {
    method: string;
    status: string;
    reference?: string;
    proofOfPayment?: string;
    paymentDetails: Record<string, any>;
  }) => void | Promise<void | boolean>;
}

export function PaymentCheckoutModal({
  open,
  onClose,
  title,
  itemType,
  itemId,
  totalAOA,
  customerName,
  customerPhone,
  deliveryAddress,
  onPaymentSuccess,
}: PaymentCheckoutModalProps) {
  const [store, setStore] = useStore();
  const { t } = useI18n();
  const [selectedMethod, setSelectedMethod] = useState<"mcx" | "ref" | "transfer" | "cash" | "wallet">("mcx");

  // Multicaixa Express State
  const [mcxPhone, setMcxPhone] = useState(customerPhone || store.currentUser?.phone || "923111222");
  const [mcxStep, setMcxStep] = useState<"input" | "waiting" | "success">("input");
  const [mcxTimer, setMcxTimer] = useState(300); // 5 minutes countdown
  const [mcxTransactionId, setMcxTransactionId] = useState("");

  // Referência Multicaixa State
  const [refEntity] = useState("00124");
  const [multicaixaRef, setMulticaixaRef] = useState("");
  const [refCopied, setRefCopied] = useState(false);
  const [refPaid, setRefPaid] = useState(false);

  // Transferência Bancária State
  const [selectedBankId, setSelectedBankId] = useState<string>("bai");
  const [ibanCopied, setIbanCopied] = useState(false);
  const [proofFileObj, setProofFileObj] = useState<File | null>(null);
  const [proofFileName, setProofFileName] = useState<string | null>(null);
  const [proofRefNumber, setProofRefNumber] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [transferSubmitted, setTransferSubmitted] = useState(false);

  // Pagamento na Entrega State
  const [deliveryPayType, setDeliveryPayType] = useState<"tpa" | "cash">("tpa");
  const [needsChange, setNeedsChange] = useState(false);
  const [changeForAmount, setChangeForAmount] = useState<number>(Math.ceil(totalAOA / 5000) * 5000);

  // Error & Async submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Carteira Digital State
  const walletBalance = store.clientWallet?.balanceAOA ?? 0;
  const hasEnoughWalletBalance = walletBalance >= totalAOA;

  // Generate Reference on mount/open
  useEffect(() => {
    if (open) {
      const randNum = Math.floor(100000000 + Math.random() * 900000000);
      const formatted = `${String(randNum).slice(0, 3)} ${String(randNum).slice(3, 6)} ${String(randNum).slice(6, 9)}`;
      setMulticaixaRef(formatted);
      setMcxTransactionId(`MCX-${Math.floor(100000 + Math.random() * 900000)}`);
      setMcxStep("input");
      setMcxTimer(300);
      setRefPaid(false);
      setTransferSubmitted(false);
      setProofFileObj(null);
      setProofFileName(null);
      setProofRefNumber("");
      setProofNote("");
      setIsSubmitting(false);
      setErrorMsg(null);
    }
  }, [open, itemId]);

  // MCX Timer Countdown
  useEffect(() => {
    if (mcxStep === "waiting" && mcxTimer > 0) {
      const interval = setInterval(() => {
        setMcxTimer((t) => (t > 0 ? t - 1 : 0));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [mcxStep, mcxTimer]);

  if (!open) return null;

  const currentBank: AngolaBank =
    ANGOLA_BANKS.find((b) => b.id === selectedBankId) || ANGOLA_BANKS[0];

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handleCopyText = (text: string, type: "ref" | "iban") => {
    navigator.clipboard?.writeText(text);
    if (type === "ref") {
      setRefCopied(true);
      setTimeout(() => setRefCopied(false), 3000);
    } else {
      setIbanCopied(true);
      setTimeout(() => setIbanCopied(false), 3000);
    }
  };

  const finalizePaymentSubmission = async (payload: {
    method: string;
    status: string;
    reference?: string;
    proofOfPayment?: string;
    paymentDetails: Record<string, any>;
  }): Promise<boolean> => {
    try {
      const result = await onPaymentSuccess(payload);
      if (result === false) {
        return false;
      }
      onClose();
      return true;
    } catch (err: any) {
      setErrorMsg(err?.message || "Falha ao registar pagamento. Tente novamente.");
      return false;
    }
  };

  // 1. Multicaixa Express Execution (No simulated instant approval)
  const handleStartMcxPayment = () => {
    setErrorMsg(null);
    if (!mcxPhone || mcxPhone.replace(/\D/g, "").length < 9) {
      setErrorMsg("Introduza um número de telemóvel angolano válido associado ao MCX Express.");
      return;
    }
    setMcxTimer(300);
    setMcxStep("waiting");
  };

  const handleConfirmMcxSuccess = async () => {
    setErrorMsg(null);
    if (mcxTimer === 0) {
      setErrorMsg("A sessão Multicaixa Express expirou após 5 minutos. Por favor inicie um novo pedido.");
      return;
    }
    setIsSubmitting(true);
    setMcxStep("success");
    const ok = await finalizePaymentSubmission({
      method: "Multicaixa Express",
      status: "Aguardando confirmação EMIS",
      reference: mcxTransactionId,
      paymentDetails: {
        method: "mcx",
        phone: mcxPhone,
        entity: "99245",
        reference: mcxTransactionId,
        requestedAt: new Date().toISOString(),
        amountAOA: totalAOA,
        awaitWebhookConfirmation: true,
      },
    });
    if (!ok) {
      setMcxStep("waiting");
    }
    setIsSubmitting(false);
  };

  // 2. Referência Multicaixa Execution (Remains pending until bank/webhook reconciliation)
  const handleConfirmRefPayment = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    setRefPaid(true);
    const ok = await finalizePaymentSubmission({
      method: "Referência Multicaixa",
      status: "Aguardando pagamento por referência",
      reference: multicaixaRef,
      paymentDetails: {
        method: "ref",
        entity: refEntity,
        reference: multicaixaRef,
        generatedAt: new Date().toISOString(),
        amountAOA: totalAOA,
        awaitBankConfirmation: true,
      },
    });
    if (!ok) {
      setRefPaid(false);
    }
    setIsSubmitting(false);
  };

  // 3. Transferência Bancária Execution
  const handleSelectProofFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) {
      setProofFileObj(null);
      setProofFileName(null);
      return;
    }
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
    if (!allowed.has(file.type)) {
      setErrorMsg("Formato inválido. Envie apenas imagem (JPG, PNG, WebP) ou documento PDF.");
      e.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("O comprovativo excede o tamanho máximo permitido de 10 MB.");
      e.target.value = "";
      return;
    }
    setProofFileObj(file);
    setProofFileName(file.name);
  };

  const handleConfirmTransfer = async () => {
    setErrorMsg(null);
    if (!proofFileObj && proofRefNumber.trim().length < 4) {
      setErrorMsg("Anexe o ficheiro do comprovativo (JPG, PNG, WebP ou PDF) ou informe o número válido da operação bancária.");
      return;
    }

    setIsSubmitting(true);
    let uploadedProofUrl: string | undefined;

    if (proofFileObj) {
      if (isSupabaseConfigured()) {
        const uploadRes = await uploadPaymentProofToStorage(
          proofFileObj,
          store.currentUser?.id || "anon",
          itemId
        );
        if (!uploadRes.ok) {
          setErrorMsg(uploadRes.error || "Não foi possível carregar o comprovativo no armazenamento seguro.");
          setIsSubmitting(false);
          return;
        }
        uploadedProofUrl = uploadRes.path || uploadRes.url;
      } else {
        uploadedProofUrl = `local-proof:${proofFileObj.name}`;
      }
    }

    setTransferSubmitted(true);
    const finalRef = proofRefNumber.trim() || `TRF-${Date.now().toString().slice(-6)}`;
    const ok = await finalizePaymentSubmission({
      method: "Transferência Bancária",
      status: "Comprovativo enviado",
      reference: finalRef,
      proofOfPayment: uploadedProofUrl,
      paymentDetails: {
        method: "transfer",
        bank: currentBank.name,
        iban: currentBank.iban,
        proofRef: finalRef,
        proofNote,
        proofFileName: proofFileName || undefined,
        proofStoragePath: uploadedProofUrl || undefined,
        submittedAt: new Date().toISOString(),
        amountAOA: totalAOA,
        requiresAccountingReview: true,
      },
    });
    if (!ok) {
      setTransferSubmitted(false);
    }
    setIsSubmitting(false);
  };

  // 4. Pagamento na Entrega Execution
  const handleConfirmDeliveryPayment = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    const changeToReturn = needsChange && changeForAmount > totalAOA ? changeForAmount - totalAOA : 0;
    await finalizePaymentSubmission({
      method: deliveryPayType === "tpa" ? "TPA na Entrega" : "Dinheiro na Entrega",
      status: "A pagar na entrega",
      paymentDetails: {
        method: "cash",
        useTPA: deliveryPayType === "tpa",
        needsChange,
        changeForAmount: needsChange ? changeForAmount : undefined,
        changeToReturn,
        amountAOA: totalAOA,
      },
    });
    setIsSubmitting(false);
  };

  // 5. Carteira Digital Execution
  const handleConfirmWalletPayment = async () => {
    setErrorMsg(null);
    if (!hasEnoughWalletBalance) {
      setErrorMsg("Saldo insuficiente na carteira.");
      return;
    }
    if (totalAOA <= 0) {
      setErrorMsg("Montante inválido para pagamento.");
      return;
    }

    const txRef = `WAL-${itemType.toUpperCase()}-${itemId}`;
    setIsSubmitting(true);

    if (isSupabaseConfigured()) {
      if (!store.currentUser?.id) {
        setErrorMsg("Inicie sessão com uma conta autenticada para utilizar a Carteira Resolve Express.");
        setIsSubmitting(false);
        return;
      }

      const rpcRes = await executeWalletMovementStrict({
        userId: store.currentUser.id,
        type: "debit",
        amountAOA: totalAOA,
        description: `Pagamento de ${itemType === "order" ? "Encomenda" : "Serviço"} ${itemId}`,
        reference: txRef,
      });

      if (!rpcRes.ok) {
        setErrorMsg(
          rpcRes.error ||
            "Não foi possível debitar a carteira no servidor (requer RPC autorizada para cliente)."
        );
        setIsSubmitting(false);
        return;
      }

      const updatedBalance = rpcRes.balanceAOA ?? Math.max(0, walletBalance - totalAOA);
      setStore((st) => ({
        clientWallet: {
          balanceAOA: updatedBalance,
          history: [
            {
              id: txRef,
              date: new Date().toISOString().slice(0, 16).replace("T", " "),
              amountAOA: totalAOA,
              type: "debit" as const,
              description: `Pagamento de ${itemType === "order" ? "Encomenda" : "Serviço"} ${itemId}`,
            },
            ...(st.clientWallet?.history || []),
          ],
        },
      }));

      await finalizePaymentSubmission({
        method: "Carteira Resolve Express",
        status: "Pago",
        reference: txRef,
        paymentDetails: {
          method: "wallet",
          paidFromWallet: true,
          remainingWalletBalance: updatedBalance,
          paidAt: new Date().toISOString(),
          amountAOA: totalAOA,
        },
      });
      setIsSubmitting(false);
      return;
    }

    // Local preview mode when Supabase is not configured
    const newBal = Math.max(0, walletBalance - totalAOA);
    setStore((st) => ({
      clientWallet: {
        balanceAOA: newBal,
        history: [
          {
            id: txRef,
            date: new Date().toISOString().slice(0, 16).replace("T", " "),
            amountAOA: totalAOA,
            type: "debit" as const,
            description: `Pagamento de ${itemType === "order" ? "Encomenda" : "Serviço"} ${itemId}`,
          },
          ...(st.clientWallet?.history || []),
        ],
      },
    }));

    await finalizePaymentSubmission({
      method: "Carteira Resolve Express",
      status: "Pago",
      reference: txRef,
      paymentDetails: {
        method: "wallet",
        paidFromWallet: true,
        remainingWalletBalance: newBal,
        paidAt: new Date().toISOString(),
        amountAOA: totalAOA,
      },
    });
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-[calc(var(--radius)*1.5)] border border-border bg-paper p-5 sm:p-7 shadow-2xl my-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-action/15 text-action">
              <Icon name="CreditCard" className="size-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-black tracking-wider text-action">
                  {t("pay_title_prefix")}
                </span>
                <span className="rounded-full bg-ok/10 text-ok px-2 py-0.2 text-[10px] font-bold">
                  Angola · {store.currency}
                </span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-black text-primary">
                {title}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                ID: <strong className="text-primary font-mono">{itemId}</strong> · <strong>{customerName}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-mist hover:text-foreground"
            aria-label={t("common_close")}
          >
            <Icon name="X" className="size-5" />
          </button>
        </div>

        {/* Order / Amount Summary Card */}
        <div className="my-4 rounded-[var(--radius)] bg-gradient-to-r from-primary to-primary/95 text-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] uppercase font-bold text-white/70 block">
              {t("pay_amount_label")}
            </span>
            <div className="font-display text-2xl sm:text-3xl font-black text-action">
              {kz(totalAOA)}
            </div>
            {store.currency !== "AOA" && (
              <span className="text-[11px] font-mono text-white/75 block mt-0.5">
                {t("pay_aoa_equiv")} {formatCurrency(totalAOA, "AOA")}
              </span>
            )}
            {deliveryAddress && (
              <p className="text-xs text-white/75 mt-1 truncate max-w-md">
                📍 {deliveryAddress}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-xs flex items-center gap-1.5 text-white">
              <Icon name="ShieldCheck" className="size-4 text-ok" /> {t("pay_protected")}
            </span>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-semibold text-destructive flex items-start gap-2">
            <Icon name="AlertTriangle" className="size-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Payment Methods Tabs */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            {t("pay_select_method")}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {PAYMENTS.map((p) => {
              const isSelected = selectedMethod === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setSelectedMethod(p.id);
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition cursor-pointer relative ${
                    isSelected
                      ? "border-action bg-action/10 text-primary shadow-xs ring-2 ring-action/20"
                      : "border-border bg-paper hover:bg-mist text-muted-foreground hover:text-primary"
                  }`}
                >
                  <span
                    className={`grid size-9 place-items-center rounded-lg mb-1.5 ${
                      isSelected ? "bg-action text-white" : "bg-mist text-primary"
                    }`}
                  >
                    <Icon name={p.icon} className="size-5" />
                  </span>
                  <span className="font-bold text-xs leading-tight line-clamp-2">
                    {p.name.split(" ")[0]} {p.name.split(" ")[1] || ""}
                  </span>
                  {p.badge && (
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full mt-1 font-bold ${
                        isSelected ? "bg-action text-white" : "bg-neutral-200 text-neutral-700"
                      }`}
                    >
                      {p.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ============================================================== */}
        {/* METHOD 1: MULTICAIXA EXPRESS (MCX) */}
        {/* ============================================================== */}
        {selectedMethod === "mcx" && (
          <div className="mt-5 rounded-2xl border border-action/30 bg-action/5 p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-xl bg-action text-white font-bold text-xs">
                MCX
              </span>
              <div>
                <h3 className="font-display text-base font-bold text-primary">
                  Pagamento com Multicaixa Express
                </h3>
                <p className="text-xs text-muted-foreground">
                  Receba uma notificação no seu telemóvel e autorize com o seu código PIN.
                </p>
              </div>
            </div>

            {mcxStep === "input" && (
              <div className="space-y-4 pt-2">
                <Field label="Número de Telemóvel associado ao Multicaixa Express">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-muted-foreground">
                      +244
                    </span>
                    <input
                      type="tel"
                      value={mcxPhone}
                      onChange={(e) => setMcxPhone(e.target.value)}
                      placeholder="923 000 000"
                      className={inputCls + " pl-14 font-mono font-bold"}
                    />
                  </div>
                </Field>

                <div className="rounded-xl bg-paper p-3 border border-border text-xs text-muted-foreground space-y-1.5">
                  <p className="flex items-center gap-1.5 font-medium text-primary">
                    <Icon name="CheckCircle2" className="size-4 text-ok" />
                    Processamento direto e seguro via EMIS Multicaixa
                  </p>
                  <p>
                    Após clicar no botão abaixo, terá 5 minutos para abrir o aplicativo Multicaixa Express no seu smartphone e validar a operação.
                  </p>
                </div>

                <Btn
                  kind="action"
                  className="w-full min-h-12 text-sm shadow-md"
                  onClick={handleStartMcxPayment}
                >
                  <Icon name="Send" className="size-4" /> Enviar Pedido para o MCX Express
                </Btn>
              </div>
            )}

            {mcxStep === "waiting" && (
              <div className="space-y-4 pt-2 text-center">
                <div className="mx-auto grid size-16 place-items-center rounded-full bg-action/20 text-action animate-pulse">
                  <Icon name="Smartphone" className="size-8" />
                </div>
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-warn/15 text-warn px-3 py-1 text-xs font-bold mb-2">
                    <Icon name="Clock" className="size-3.5" /> Tempo restante: {formatTimer(mcxTimer)}
                  </span>
                  <h4 className="font-display text-lg font-black text-primary">
                    A aguardar validação na aplicação MCX
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                    Enviámos um pedido de <strong>{kz(totalAOA)}</strong> para o telemóvel <strong>+244 {mcxPhone}</strong>. Abra a app Multicaixa Express e confirme com o seu PIN.
                  </p>
                </div>

                <div className="rounded-xl bg-paper p-4 border border-border text-left text-xs space-y-2 max-w-md mx-auto font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Comerciante:</span>
                    <span className="font-bold text-primary">RESOLVE EXPRESS LDA</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Entidade EMIS:</span>
                    <span className="font-bold text-primary">99245</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID Transação:</span>
                    <span className="font-bold text-action">{mcxTransactionId}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1 font-bold">
                    <span>Montante:</span>
                    <span className="text-primary">{kz(totalAOA)}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                  <Btn
                    kind="action"
                    disabled={isSubmitting || mcxTimer === 0}
                    className="min-h-11 px-6 text-xs shadow-md"
                    onClick={handleConfirmMcxSuccess}
                  >
                    <Icon name="Clock" className="size-4" />{" "}
                    {isSubmitting
                      ? "A registar pedido..."
                      : "Submeter Pedido MCX (Aguardando Confirmação EMIS)"}
                  </Btn>
                  <Btn
                    kind="ghost"
                    disabled={isSubmitting}
                    className="min-h-11 px-4 text-xs"
                    onClick={() => setMcxStep("input")}
                  >
                    Alterar Telemóvel
                  </Btn>
                </div>
              </div>
            )}

            {mcxStep === "success" && (
              <div className="py-6 text-center space-y-2">
                <div className="mx-auto grid size-14 place-items-center rounded-full bg-warn text-white">
                  <Icon name="Clock" className="size-8" />
                </div>
                <h4 className="font-display text-lg font-black text-primary">
                  Pedido MCX Registado (Aguardando Confirmação EMIS)
                </h4>
                <p className="text-xs text-muted-foreground">
                  O pedido de {kz(totalAOA)} ficou registado como pendente até validação bancária / EMIS.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* METHOD 2: REFERÊNCIA MULTICAIXA (ATM / BANCO ONLINE) */}
        {/* ============================================================== */}
        {selectedMethod === "ref" && (
          <div className="mt-5 rounded-2xl border border-border bg-mist/60 p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-xl bg-primary text-white font-bold text-xs">
                ATM
              </span>
              <div>
                <h3 className="font-display text-base font-bold text-primary">
                  Pagamento por Referência Multicaixa
                </h3>
                <p className="text-xs text-muted-foreground">
                  Pague em qualquer Caixa Automático (ATM) ou Internet Banking (BFA Net, BAI Directo, etc.).
                </p>
              </div>
            </div>

            {/* Official Styled Multicaixa Slip */}
            <div className="relative overflow-hidden rounded-xl border-2 border-primary/20 bg-paper p-5 shadow-md">
              <div className="flex items-center justify-between border-b border-dashed border-border pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="bg-primary text-white font-black text-xs px-2.5 py-1 rounded tracking-widest font-mono">
                    MULTICAIXA
                  </div>
                  <span className="text-xs font-bold text-muted-foreground">Pagamento de Serviços</span>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground">
                  Validade: 48 Horas
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center sm:text-left py-2 font-mono">
                <div className="bg-mist p-3 rounded-lg border border-border">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Entidade
                  </span>
                  <span className="font-display text-xl font-black text-primary tracking-wider">
                    {refEntity}
                  </span>
                </div>

                <div className="bg-mist p-3 rounded-lg border border-border">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Referência
                  </span>
                  <span className="font-display text-xl font-black text-action tracking-wider">
                    {multicaixaRef}
                  </span>
                </div>

                <div className="bg-mist p-3 rounded-lg border border-border">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    {t("pay_amount_label")}
                  </span>
                  <span className="font-display text-xl font-black text-primary tracking-wider">
                    {kz(totalAOA)}
                  </span>
                  {store.currency !== "AOA" && (
                    <span className="block text-[10px] text-muted-foreground mt-0.5">
                      ({formatCurrency(totalAOA, "AOA")})
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 justify-between items-center border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() =>
                    handleCopyText(
                      `Pagamento Multicaixa Resolve Express\nEntidade: ${refEntity}\nReferência: ${multicaixaRef}\nMontante: ${kz(totalAOA)}`,
                      "ref"
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 hover:bg-primary hover:text-white px-3 py-1.5 text-xs font-bold text-primary transition"
                >
                  <Icon name={refCopied ? "Check" : "Copy"} className="size-3.5" />
                  {refCopied ? "Dados Copiados!" : "Copiar Dados da Referência"}
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-mist transition"
                >
                  <Icon name="Printer" className="size-3.5" /> Imprimir Talão
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="rounded-xl bg-paper p-4 border border-border text-xs space-y-2">
              <p className="font-bold text-primary flex items-center gap-1.5">
                <Icon name="Info" className="size-4 text-action" /> Como Pagar no ATM ou App Bancária:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground pl-1">
                <li>No ecrã do Caixa Automático ou no seu Internet Banking, selecione <strong>Pagamentos</strong>.</li>
                <li>Escolha <strong>Pagamentos por Referência</strong> ou <strong>Pagamento de Serviços</strong>.</li>
                <li>Introduza a Entidade: <strong className="text-primary font-mono">{refEntity}</strong>.</li>
                <li>Introduza a Referência: <strong className="text-primary font-mono">{multicaixaRef}</strong>.</li>
                <li>Confirme o valor de <strong className="text-primary">{kz(totalAOA)}</strong> e guarde o talão comprovativo.</li>
              </ol>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <Btn
                kind="action"
                disabled={isSubmitting}
                className="w-full sm:w-auto min-h-11 px-6 text-xs shadow-md"
                onClick={handleConfirmRefPayment}
              >
                <Icon name="FileText" className="size-4" />{" "}
                {isSubmitting
                  ? "A registar referência..."
                  : refPaid
                  ? "Referência Registada (Pendente)"
                  : "Registar Referência e Concluir Pedido"}
              </Btn>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* METHOD 3: TRANSFERÊNCIA BANCÁRIA (IBAN) */}
        {/* ============================================================== */}
        {selectedMethod === "transfer" && (
          <div className="mt-5 rounded-2xl border border-border bg-mist/60 p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-xl bg-primary text-white font-bold text-xs">
                IBAN
              </span>
              <div>
                <h3 className="font-display text-base font-bold text-primary">
                  Transferência Bancária Oficial
                </h3>
                <p className="text-xs text-muted-foreground">
                  Transfira para uma das contas oficiais da Resolve Express e anexe o talão/comprovativo.
                </p>
              </div>
            </div>

            {/* Bank Selector */}
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1.5">
                Selecione o seu Banco de Destino:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ANGOLA_BANKS.map((bank) => {
                  const isCur = selectedBankId === bank.id;
                  return (
                    <button
                      key={bank.id}
                      type="button"
                      onClick={() => setSelectedBankId(bank.id)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        isCur
                          ? "border-action bg-paper ring-2 ring-action/20"
                          : "border-border bg-paper/60 hover:bg-paper"
                      }`}
                    >
                      <span className="font-display font-black text-sm text-primary block">
                        {bank.shortName}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate block">
                        {bank.name.split("(")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bank Details Card */}
            <div className="rounded-xl border border-border bg-paper p-4 space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center pb-2 border-b border-border">
                <span className="text-muted-foreground font-sans">Banco Selecionado:</span>
                <span className="font-bold text-primary font-sans">{currentBank.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-sans">Titular da Conta:</span>
                <span className="font-bold text-primary">{currentBank.holder}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-sans">NIF da Empresa:</span>
                <span className="font-bold text-primary">{currentBank.nif}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-2 border-t border-border">
                <span className="text-muted-foreground font-sans">IBAN Angolano:</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-action text-sm select-all">
                    {currentBank.iban}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(currentBank.iban, "iban")}
                    className="p-1 rounded hover:bg-mist text-muted-foreground hover:text-foreground"
                    title="Copiar IBAN"
                  >
                    <Icon name={ibanCopied ? "Check" : "Copy"} className="size-4 text-action" />
                  </button>
                </div>
              </div>
            </div>

            {/* Proof Upload & Details */}
            <div className="space-y-3 pt-2">
              <Field label="Anexar Comprovativo de Transferência (Foto JPG/PNG/WebP ou PDF, máx. 10MB)">
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,.pdf"
                    onChange={handleSelectProofFile}
                    className={inputCls + " file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-primary file:text-white hover:file:bg-action"}
                  />
                </div>
                {proofFileName && (
                  <div className="mt-2 flex items-center gap-2 rounded bg-ok/10 text-ok p-2 text-xs font-bold">
                    <Icon name="CheckCircle2" className="size-4" /> Ficheiro selecionado: {proofFileName}
                  </div>
                )}
              </Field>

              <Field label="Nº de Operação Bancária / Talão (Obrigatório se não anexar ficheiro)">
                <input
                  type="text"
                  value={proofRefNumber}
                  onChange={(e) => setProofRefNumber(e.target.value)}
                  placeholder="Ex: TRF-948123 / BAI-02941"
                  className={inputCls}
                />
              </Field>

              <Field label="Observações ou Notas (Opcional)">
                <input
                  type="text"
                  value={proofNote}
                  onChange={(e) => setProofNote(e.target.value)}
                  placeholder="Ex: Transferido a partir da conta de Manuel Silva"
                  className={inputCls}
                />
              </Field>

              <Btn
                kind="action"
                disabled={isSubmitting || transferSubmitted}
                className="w-full min-h-12 text-sm shadow-md mt-2"
                onClick={handleConfirmTransfer}
              >
                <Icon name="UploadCloud" className="size-4" />{" "}
                {isSubmitting
                  ? "A enviar comprovativo..."
                  : "Submeter Comprovativo e Concluir Pedido"}
              </Btn>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* METHOD 4: PAGAMENTO NA ENTREGA (TPA OU DINHEIRO) */}
        {/* ============================================================== */}
        {selectedMethod === "cash" && (
          <div className="mt-5 rounded-2xl border border-border bg-mist/60 p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-xl bg-action text-white font-bold text-xs">
                COD
              </span>
              <div>
                <h3 className="font-display text-base font-bold text-primary">
                  Pagamento no Acto da Entrega / Domicílio
                </h3>
                <p className="text-xs text-muted-foreground">
                  Pague com total conveniência quando o estafeta ou profissional chegar à sua residência.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeliveryPayType("tpa")}
                className={`p-4 rounded-xl border text-left transition cursor-pointer ${
                  deliveryPayType === "tpa"
                    ? "border-action bg-paper ring-2 ring-action/20 shadow-xs"
                    : "border-border bg-paper/60 hover:bg-paper"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon name="CreditCard" className="size-5 text-action" />
                  <span className="font-display font-bold text-sm text-primary">
                    TPA Móvel (Cartão)
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  O estafeta leva um terminal Multicaixa sem fios para pagar com o seu cartão bancário.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDeliveryPayType("cash")}
                className={`p-4 rounded-xl border text-left transition cursor-pointer ${
                  deliveryPayType === "cash"
                    ? "border-action bg-paper ring-2 ring-action/20 shadow-xs"
                    : "border-border bg-paper/60 hover:bg-paper"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon name="Banknote" className="size-5 text-action" />
                  <span className="font-display font-bold text-sm text-primary">
                    Dinheiro Vivo
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Pagamento em notas físicas de Kwanzas no acto da entrega dos produtos ou serviço.
                </p>
              </button>
            </div>

            {deliveryPayType === "cash" && (
              <div className="rounded-xl bg-paper p-4 border border-border space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="needsChangeCheckbox"
                    checked={needsChange}
                    onChange={(e) => setNeedsChange(e.target.checked)}
                    className="size-4 accent-action rounded"
                  />
                  <label htmlFor="needsChangeCheckbox" className="text-xs font-bold text-primary cursor-pointer">
                    Preciso de troco para esta encomenda
                  </label>
                </div>

                {needsChange && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <span className="text-xs text-muted-foreground block">
                      Vai pagar com que nota/montante?
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {[5000, 10000, 20000, 50000].map((amt) => {
                        if (amt < totalAOA) return null;
                        return (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setChangeForAmount(amt)}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition ${
                              changeForAmount === amt
                                ? "bg-action text-white border-action"
                                : "bg-mist border-border text-primary hover:bg-paper"
                            }`}
                          >
                            {kz(amt)}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between text-xs bg-mist p-2.5 rounded-lg font-mono">
                      <span>Troco a devolver pelo estafeta:</span>
                      <span className="font-bold text-action text-sm">
                        {changeForAmount > totalAOA ? kz(changeForAmount - totalAOA) : "Sem troco"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <Btn
              kind="action"
              disabled={isSubmitting}
              className="w-full min-h-12 text-sm shadow-md mt-2"
              onClick={handleConfirmDeliveryPayment}
            >
              <Icon name="Check" className="size-4" />{" "}
              {isSubmitting ? "A registar..." : "Confirmar Pagamento na Entrega"}
            </Btn>
          </div>
        )}

        {/* ============================================================== */}
        {/* METHOD 5: CARTEIRA DIGITAL RESOLVE EXPRESS */}
        {/* ============================================================== */}
        {selectedMethod === "wallet" && (
          <div className="mt-5 rounded-2xl border border-border bg-mist/60 p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-xl bg-action text-white font-bold text-xs">
                REX
              </span>
              <div>
                <h3 className="font-display text-base font-bold text-primary">
                  Carteira Digital Resolve Express
                </h3>
                <p className="text-xs text-muted-foreground">
                  Debite do saldo pré-pago da sua conta na plataforma.
                </p>
              </div>
            </div>

            {/* Wallet Balance Card */}
            <div className="rounded-xl border border-border bg-paper p-5 shadow-xs space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-muted-foreground">
                  Saldo Disponível na Carteira:
                </span>
                <span className="font-display text-2xl font-black text-primary">
                  {kz(walletBalance)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-muted-foreground border-t border-border pt-2">
                <span>Valor a Debitar:</span>
                <span className="font-bold text-destructive">-{kz(totalAOA)}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-border pt-2 font-bold">
                <span>Saldo Estimado Após Compra:</span>
                <span className={hasEnoughWalletBalance ? "text-ok" : "text-destructive"}>
                  {kz(Math.max(0, walletBalance - totalAOA))}
                </span>
              </div>
            </div>

            {hasEnoughWalletBalance ? (
              <Btn
                kind="action"
                disabled={isSubmitting}
                className="w-full min-h-12 text-sm shadow-md"
                onClick={handleConfirmWalletPayment}
              >
                <Icon name="CheckCircle2" className="size-4" />{" "}
                {isSubmitting ? "A debitar carteira..." : "Pagar Agora com Saldo da Carteira"}
              </Btn>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl bg-destructive/10 text-destructive p-3.5 text-xs font-semibold flex items-center gap-2">
                  <Icon name="AlertTriangle" className="size-5 shrink-0" />
                  Saldo insuficiente para liquidar esta transação. Faltam {kz(totalAOA - walletBalance)}.
                </div>
                <Btn
                  kind="ink"
                  className="w-full min-h-11 text-xs"
                  onClick={() => setSelectedMethod("mcx")}
                >
                  Pagar Diferença com Multicaixa Express
                </Btn>
              </div>
            )}
          </div>
        )}

        {/* Footer Guarantee */}
        <div className="mt-5 border-t border-border pt-3 flex flex-wrap items-center justify-between text-[11px] text-muted-foreground gap-2">
          <span className="flex items-center gap-1">
            <Icon name="ShieldCheck" className="size-3.5 text-ok" />
            Transações encriptadas e auditadas em conformidade com o BNA
          </span>
          <span className="font-bold text-primary">Resolve Express · Huambo, Angola</span>
        </div>
      </div>
    </div>
  );
}
