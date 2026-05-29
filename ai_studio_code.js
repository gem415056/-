// ==UserScript==
// @name         알리미 (국소지진계)
// @namespace    https://github.com/milkyway0308/crystallized-chasm/
// @version      1.1
// @description  요약 메모리 변경 감지 알림 기능을 통합 제공합니다.
// @author       User & milkyway0308 & Gemini
// @match        https://crack.wrtn.ai/*
// @grant        GM_addStyle
// @require      https://cdn.jsdelivr.net/npm/dexie@4.2.1/dist/dexie.min.js#sha256-STeEejq7AcFOvsszbzgCDL82AjypbLLjD5O6tUByfuA=
// @require      https://cdn.jsdelivr.net/gh/milkyway0308/crystallized-chasm@crack-toastify-injection@v1.0.0/crack/libraries/toastify-injection.js
// @require      https://cdn.jsdelivr.net/gh/milkyway0308/crystallized-chasm@crack-shared-core@v1.2.1/crack/libraries/crack-shared-core.js
// @require      https://cdn.jsdelivr.net/gh/milkyway0308/crystallized-chasm@chasm-shared-core@v1.0.0/libraries/chasm-shared-core.js
// @require      https://cdn.jsdelivr.net/gh/milkyway0308/crystallized-chasm@decentralized-pre-1.0.15/decentralized-modal.js
// ==/UserScript==

(function () {
    'use strict';

    /* 
       [독립형 알약 알림창 구현]
       외부 라이브러리 간섭 없이, 지정된 상하 높이 좌표(top: calc(50% - 142px))와 
       고급 다크 티엘 테마 색상을 온전히 출력하도록 자체 제작한 콤팩트 알림창 함수입니다.
    */
    function showChasmSeismometerToast(message, expires = 3000) {
        const existing = document.getElementById("chasm-seismometer-toast");
        if (existing) {
            existing.remove();
        }

        const wrapperNode = document.createElement("div");
        wrapperNode.id = "chasm-seismometer-toast";
        wrapperNode.style.cssText = `
            position: fixed;
            top: calc(50% - 142px);
            left: 50%;
            transform: translate(-50%, -50%) scale(0.9);
            opacity: 0;
            transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.2), opacity 0.15s ease;
            z-index: 999999999 !important;
            pointer-events: none;
            display: flex;
            justify-content: center;
            align-items: center;
            width: fit-content;
            height: fit-content;
        `;

        const containerNode = document.createElement("div");
        /* 요청하신 다크 세련 테마 대입: 배경 #23343A, 테두리 #88B9C8 */
        containerNode.style.cssText = `
            background-color: #23343A;
            border: 1.5px solid #88B9C8;
            padding: 9px 14px;
            border-radius: 9999px;
            display: inline-flex;
            justify-content: center;
            align-items: center;
            box-shadow: 0 4px 16px rgba(0,0,0,0.3);
            box-sizing: border-box;
        `;

        const textNode = document.createElement("p");
        textNode.textContent = message;
        /* 파스텔 화이트 #EFFCFF 글자색 및 컴팩트 12px 굵은 서체 지정 */
        textNode.style.cssText = `
            color: #EFFCFF;
            text-align: center;
            font-size: 12px;
            font-weight: 700;
            line-height: 100%;
            margin: 0;
            padding: 0;
            white-space: nowrap;
            user-select: none;
        `;

        containerNode.append(textNode);
        wrapperNode.append(containerNode);
        document.body.appendChild(wrapperNode);

        /* 자연스럽게 정중앙에서 확장되며 선명해지는 페이드 인 */
        setTimeout(() => {
            wrapperNode.style.transform = "translate(-50%, -50%) scale(1)";
            wrapperNode.style.opacity = "1";
        }, 20);

        /* 수명 만료 후 소멸하는 오토 클리너 */
        setTimeout(() => {
            if (document.body.contains(wrapperNode)) {
                wrapperNode.style.transform = "translate(-50%, -50%) scale(0.93)";
                wrapperNode.style.opacity = "0";
                setTimeout(() => {
                    if (document.body.contains(wrapperNode)) {
                        wrapperNode.remove();
                    }
                }, 200);
            }
        }, expires);
    }

    // ==========================================
    // 모듈 1: 국소지진계 (요약 메모리 변경 감지)
    // ==========================================
    async function initLocalSeismometer() {
        const STANDARD_NOTIFICATION_TIME = 3000;
        const logger = new LogUtil("Chasm Crystallized Local Sesimometer", false);
        /** @type {string | undefined} */
        let lastErrorToken = undefined;
        // @ts-ignore
        const db = new Dexie("chasm-local-seismometer");
        await db.version(1).stores({
            cache: `roomId, summaryId`,
        });

        async function check() {
            if (!CrackUtil.path().isChattingPath()) return;
            const split = window.location.pathname.substring(1).split("/");
            const chatRoomId = split[3];
            const url = `https://contents-api.wrtn.ai/character-chat/v3/chats/${chatRoomId}/summaries?limit=1`;
            if (
                lastErrorToken &&
                lastErrorToken === CrackUtil.cookie().getAuthToken()
            ) {
                return;
            }
            const usedToken = CrackUtil.cookie().getAuthToken();
            const fetch = await CrackUtil.network().authFetch("GET", url);
            if (fetch instanceof Error) {
                // @ts-ignore
                if (fetch.code && fetch.code === 401) {
                    lastErrorToken = usedToken;
                    logger.log(
                        "인증 토큰 만료로 인해 요청에 실패하여 요약 메모리 감시 태스크를 뒤로 미룹니다.",
                    );
                }
                return;
            }
            lastErrorToken = undefined;
            const data = fetch.data?.summaries;
            if (!data || data.length <= 0) {
                return;
            }
            const result = await db.cache.where("roomId").anyOf(chatRoomId).toArray();
            if (result.length > 0) {
                if (result[0].summaryId === data[0]._id) {
                    return;
                }
            }
            await db.cache.put({
                roomId: chatRoomId,
                summaryId: data[0]._id,
            });
            /* 기존의 둔탁한 오리지널 알림창 대신 자체 구현한 컴팩트 중앙 알약 알림창을 띄우도록 바인딩 */
            showChasmSeismometerToast(
                "요약 메모리의 변경이 감지되었어요.",
                STANDARD_NOTIFICATION_TIME,
            );
        }
        setInterval(check, 1500);
    }

    // ==========================================
    // 통합팩 실행 관리자 (자명종 모듈 완전 제거 완료)
    // ==========================================
    function startAll() {
        console.log("[알리미] 국소지진계 전용 스크립트 실행 시작");

        setTimeout(() => {
            try {
                initLocalSeismometer();
                console.log("[알리미] 국소지진계 모듈이 성공적으로 초기화되었습니다.");
            } catch (e) {
                console.error("[알리미] 국소지진계 모듈 초기화 중 오류 발생:", e);
            }
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startAll);
    } else {
        startAll();
    }

})();