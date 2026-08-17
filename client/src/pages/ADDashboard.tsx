import { AICommandCenter } from "./AICommandCenter";

/**
 * AD 首页只保留 AI 原生作战指挥中心。
 * 重构前的数据优先看板已彻底下线，避免与“AI 先研判、AD 再确认”的工作流混排。
 */
export default function ADDashboard() {
  return <AICommandCenter />;
}
